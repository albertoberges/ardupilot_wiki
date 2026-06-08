"""
Editor de programas con sintaxis resaltada al estilo RAPID de ABB.

Instrucciones soportadas:
  MOVJ  J1 J2 J3 J4 J5 J6 V<speed>        → Movimiento articular
  MOVL  X Y Z V<speed>                      → Movimiento lineal
  GOTO  <nombre_punto>                      → Ir a punto enseñado
  WAIT  <segundos>                          → Esperar
  SET   DO<n> <0|1>                         → Salida digital
  LOOP  <n>                                 → Repetir n veces
  END                                       → Fin de bucle
  ; comentario                              → Línea de comentario
"""

import re
import time
import threading
import numpy as np

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QTextEdit, QPlainTextEdit, QLabel, QSplitter,
    QListWidget, QListWidgetItem, QInputDialog, QMessageBox, QGroupBox
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QThread, QObject
from PyQt6.QtGui import (
    QFont, QColor, QTextCharFormat, QSyntaxHighlighter,
    QTextDocument, QTextCursor, QPalette
)


# ------------------------------------------------------------------ #
# Resaltado de sintaxis                                                #
# ------------------------------------------------------------------ #

class RapidHighlighter(QSyntaxHighlighter):
    """Resalta sintaxis del lenguaje de programación del robot."""

    RULES = [
        # Instrucciones de movimiento
        (r'\b(MOVJ|MOVL|GOTO|MOVP)\b', "#4fc3f7", True),
        # Control de flujo
        (r'\b(WAIT|LOOP|END|REPEAT|IF|ELSE|ENDIF)\b', "#ce93d8", True),
        # I/O
        (r'\b(SET|GET|DO|DI)\b', "#80cbc4", True),
        # Palabras especiales
        (r'\b(HOME|SPEED|TOOL|WORK)\b', "#ffb74d", True),
        # Velocidad (V100, V50...)
        (r'\bV\d+\b', "#a5d6a7", False),
        # Números
        (r'[+-]?\d+\.?\d*', "#e6db74", False),
        # Comentarios (;)
        (r';.*$', "#6a9955", False),
        # Nombres de puntos (pHome, p1, etc.)
        (r'\b[pP][A-Za-z0-9_]+\b', "#f8bbd0", False),
    ]

    def __init__(self, document: QTextDocument):
        super().__init__(document)
        self._rules = []
        for pattern, color, bold in self.RULES:
            fmt = QTextCharFormat()
            fmt.setForeground(QColor(color))
            if bold:
                fmt.setFontWeight(700)
            self._rules.append((re.compile(pattern, re.MULTILINE), fmt))

    def highlightBlock(self, text: str):
        for regex, fmt in self._rules:
            for m in regex.finditer(text):
                self.setFormat(m.start(), m.end() - m.start(), fmt)


# ------------------------------------------------------------------ #
# Ejecutor de programas                                                #
# ------------------------------------------------------------------ #

class ProgramRunner(QObject):
    """Ejecuta el programa en un hilo separado."""

    line_changed = pyqtSignal(int)       # Línea siendo ejecutada
    finished = pyqtSignal(bool, str)     # (éxito, mensaje)
    log_message = pyqtSignal(str)        # Mensaje para el log

    def __init__(self, robot, comm, taught_points: dict):
        super().__init__()
        self.robot = robot
        self.comm = comm
        self.taught_points = taught_points
        self._stop_flag = False
        self._pause_flag = False

    def stop(self):
        self._stop_flag = True

    def pause(self):
        self._pause_flag = not self._pause_flag

    def run(self, lines: list):
        """Ejecuta las líneas del programa."""
        self._stop_flag = False
        self._pause_flag = False

        # Expandir bucles
        expanded = self._expand_loops(lines)
        if expanded is None:
            self.finished.emit(False, "Error en estructura LOOP/END")
            return

        for line_idx, (orig_line, instruction) in enumerate(expanded):
            if self._stop_flag:
                self.finished.emit(False, "Programa detenido por el usuario")
                return

            while self._pause_flag and not self._stop_flag:
                time.sleep(0.1)

            self.line_changed.emit(orig_line)

            success, msg = self._execute(instruction)
            if not success:
                self.finished.emit(False, f"Error en línea {orig_line + 1}: {msg}")
                return

            if self._stop_flag:
                break

        self.finished.emit(True, "Programa completado correctamente")

    def _expand_loops(self, lines):
        """Expande bucles LOOP n ... END."""
        result = []
        stack = []
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line or line.startswith(';'):
                i += 1
                continue
            tokens = line.upper().split()
            if tokens[0] == 'LOOP':
                count = int(tokens[1]) if len(tokens) > 1 else 1
                stack.append((i, count, []))
            elif tokens[0] == 'END' and stack:
                start_i, count, body = stack.pop()
                for _ in range(count):
                    for bline_idx, binstr in body:
                        result.append((bline_idx, binstr))
            elif stack:
                stack[-1][2].append((i, line))
            else:
                result.append((i, line))
            i += 1
        if stack:
            return None
        return result

    def _execute(self, instruction: str) -> tuple:
        """Ejecuta una instrucción. Devuelve (éxito, mensaje)."""
        if not instruction or instruction.startswith(';'):
            return True, ""

        tokens = instruction.upper().split()
        cmd = tokens[0]

        try:
            if cmd == 'MOVJ':
                # MOVJ J1 J2 J3 J4 J5 J6 V<speed>
                q = [float(tokens[i]) for i in range(1, 7)]
                self.robot.set_joints(q)
                self.comm.send_joints(self.robot.joint_angles)
                speed = self._parse_speed(tokens, 7)
                time.sleep(max(0.1, 2.0 * (1 - speed / 100)))

            elif cmd == 'MOVL':
                # MOVL X Y Z V<speed>
                xyz = np.array([float(tokens[i]) for i in range(1, 4)])
                ok = self.robot.jog_cartesian(xyz - self.robot.forward_kinematics()[:3, 3])
                if not ok:
                    return False, "No se pudo alcanzar la posición cartesiana"
                self.comm.send_joints(self.robot.joint_angles)
                time.sleep(0.3)

            elif cmd == 'GOTO':
                # GOTO nombre_punto
                point_name = tokens[1]
                if point_name not in self.taught_points:
                    return False, f"Punto '{point_name}' no definido"
                q = self.taught_points[point_name]
                self.robot.set_joints(q)
                self.comm.send_joints(self.robot.joint_angles)
                time.sleep(0.5)

            elif cmd == 'WAIT':
                t = float(tokens[1])
                time.sleep(t)

            elif cmd == 'HOME':
                self.robot.move_home()
                self.comm.send_home()
                time.sleep(0.5)

            elif cmd == 'SET':
                pass  # Implementar salidas digitales

            else:
                self.log_message.emit(f"Instrucción desconocida: {cmd}")

            return True, ""

        except (IndexError, ValueError) as e:
            return False, str(e)

    @staticmethod
    def _parse_speed(tokens: list, idx: int, default: int = 50) -> int:
        if idx < len(tokens):
            t = tokens[idx]
            if t.startswith('V'):
                return int(t[1:])
        return default


# ------------------------------------------------------------------ #
# Widget principal del editor                                          #
# ------------------------------------------------------------------ #

class ProgramPanel(QWidget):
    """Editor de programas con resaltado de sintaxis y ejecución."""

    robot_moved = pyqtSignal()

    # Programa de ejemplo inicial
    EXAMPLE_PROGRAM = """; === Programa de ejemplo ===
; Demostración de movimientos básicos

HOME                    ; Ir a posición de reposo

; Mover a posición 1
MOVJ 0 -45 90 0 45 0 V30

; Mover a posición 2
MOVJ 45 -30 60 0 30 0 V50

; Volver a home
HOME

; Repetir movimiento 3 veces
LOOP 3
  MOVJ 30 -60 90 0 60 0 V80
  WAIT 0.5
  MOVJ -30 -60 90 0 60 0 V80
  WAIT 0.5
END

HOME
"""

    def __init__(self, robot, comm_manager, parent=None):
        super().__init__(parent)
        self.robot = robot
        self.comm = comm_manager
        self.taught_points: dict = {}  # nombre → np.ndarray de ángulos
        self._runner: ProgramRunner | None = None
        self._runner_thread: QThread | None = None
        self._current_line = -1

        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # ---- Barra de herramientas ---- #
        toolbar = QHBoxLayout()
        toolbar.setSpacing(4)

        buttons = [
            ("▶  EJECUTAR", "#006400", "#00a040", self._run),
            ("⏸  PAUSAR",   "#4a4a00", "#8a8a00", self._pause),
            ("⏹  DETENER",  "#600000", "#a00000", self._stop),
            ("🏠  HOME",     "#300050", "#600090", self._go_home),
        ]
        self._btn_run = self._btn_pause = self._btn_stop = None

        for i, (text, bg, hover, handler) in enumerate(buttons):
            btn = QPushButton(text)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {bg}; color: #e0e0e0;
                    border: 1px solid {hover}; padding: 6px 12px;
                    border-radius: 4px; font-weight: bold; font-size: 12px;
                }}
                QPushButton:hover {{ background-color: {hover}; }}
            """)
            btn.clicked.connect(handler)
            toolbar.addWidget(btn)
            if i == 0: self._btn_run = btn
            elif i == 1: self._btn_pause = btn
            elif i == 2: self._btn_stop = btn

        toolbar.addStretch()

        # Botón agregar punto enseñado
        teach_btn = QPushButton("📍  Agregar Punto")
        teach_btn.setStyleSheet("""
            QPushButton {
                background-color: #1a0040; color: #c080ff;
                border: 1px solid #6030c0; padding: 6px 12px;
                border-radius: 4px; font-size: 12px;
            }
            QPushButton:hover { background-color: #3000a0; }
        """)
        teach_btn.clicked.connect(self._teach_point)
        toolbar.addWidget(teach_btn)

        layout.addLayout(toolbar)

        # ---- Splitter: editor | puntos enseñados ---- #
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Editor
        self._editor = QPlainTextEdit()
        self._editor.setPlainText(self.EXAMPLE_PROGRAM)
        self._editor.setFont(QFont("Cascadia Code,Consolas,Courier New", 13))
        self._editor.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self._highlighter = RapidHighlighter(self._editor.document())
        splitter.addWidget(self._editor)

        # Panel de puntos enseñados
        points_widget = QWidget()
        points_layout = QVBoxLayout(points_widget)
        points_layout.setContentsMargins(4, 0, 0, 0)

        points_header = QLabel("PUNTOS ENSEÑADOS")
        points_header.setStyleSheet(
            "color: #7ec8e3; font-weight: bold; font-size: 11px; "
            "letter-spacing: 1px; padding: 4px;"
        )
        points_layout.addWidget(points_header)

        self._points_list = QListWidget()
        self._points_list.setStyleSheet("""
            QListWidget { background: #0d1117; border: 1px solid #0f3460; }
            QListWidget::item { padding: 4px; border-bottom: 1px solid #0f1520; }
            QListWidget::item:selected { background: #0078d4; }
        """)
        self._points_list.itemDoubleClicked.connect(self._goto_point)
        points_layout.addWidget(self._points_list)

        del_btn = QPushButton("Eliminar punto")
        del_btn.setStyleSheet("""
            QPushButton { background: #3a0000; color: #ff8080;
                border: 1px solid #700000; padding: 4px; border-radius: 3px; }
            QPushButton:hover { background: #700000; }
        """)
        del_btn.clicked.connect(self._delete_point)
        points_layout.addWidget(del_btn)

        splitter.addWidget(points_widget)
        splitter.setSizes([700, 250])
        layout.addWidget(splitter, 1)

        # ---- Log de ejecución ---- #
        self._log = QTextEdit()
        self._log.setReadOnly(True)
        self._log.setMaximumHeight(100)
        self._log.setFont(QFont("Consolas,Courier New", 11))
        layout.addWidget(self._log)

        self._log_message("Editor listo. Escriba su programa o use el ejemplo.")

        self._set_running(False)

    # ------------------------------------------------------------------ #
    # Control de ejecución                                                 #
    # ------------------------------------------------------------------ #

    def _run(self):
        if self._runner_thread and self._runner_thread.isRunning():
            return

        lines = self._editor.toPlainText().splitlines()
        self._runner = ProgramRunner(self.robot, self.comm, self.taught_points)
        self._runner.line_changed.connect(self._highlight_line)
        self._runner.finished.connect(self._on_finished)
        self._runner.log_message.connect(self._log_message)

        self._runner_thread = QThread()
        self._runner.moveToThread(self._runner_thread)
        self._runner_thread.started.connect(lambda: self._runner.run(lines))
        self._runner_thread.start()

        self._set_running(True)
        self._log_message("▶ Ejecutando programa...")

    def _pause(self):
        if self._runner:
            self._runner.pause()
            self._log_message("⏸ Programa pausado / reanudado")

    def _stop(self):
        if self._runner:
            self._runner.stop()
        self._log_message("⏹ Deteniendo programa...")
        self._set_running(False)

    def _go_home(self):
        self.robot.move_home()
        self.comm.send_home()
        self.robot_moved.emit()
        self._log_message("🏠 Moviendo a HOME")

    def _on_finished(self, success: bool, msg: str):
        self._set_running(False)
        color = "#00ff88" if success else "#ff4444"
        self._log_message(f'<span style="color:{color}">{msg}</span>')
        self.robot_moved.emit()

    def _set_running(self, running: bool):
        self._btn_run.setEnabled(not running)
        self._btn_stop.setEnabled(running)
        self._editor.setReadOnly(running)

    def _highlight_line(self, line_idx: int):
        """Resalta la línea que se está ejecutando."""
        self._current_line = line_idx
        cursor = self._editor.textCursor()
        doc = self._editor.document()
        block = doc.findBlockByLineNumber(line_idx)
        cursor.setPosition(block.position())
        cursor.movePosition(QTextCursor.MoveOperation.EndOfBlock,
                            QTextCursor.MoveMode.KeepAnchor)

        fmt = QTextCharFormat()
        fmt.setBackground(QColor("#1a3a00"))
        fmt.setForeground(QColor("#00ff88"))

        extra = self._editor.extraSelections()
        sel = QTextEdit.ExtraSelection()
        sel.format = fmt
        sel.cursor = cursor
        self._editor.setExtraSelections([sel])
        self._editor.setTextCursor(cursor)
        self.robot_moved.emit()

    # ------------------------------------------------------------------ #
    # Puntos enseñados                                                     #
    # ------------------------------------------------------------------ #

    def _teach_point(self):
        """Enseña el punto actual del robot."""
        name, ok = QInputDialog.getText(
            self, "Enseñar Punto", "Nombre del punto:",
            text=f"p{len(self.taught_points) + 1}"
        )
        if not ok or not name.strip():
            return
        name = name.strip()
        self.taught_points[name] = self.robot.joint_angles.copy()
        self._update_points_list()
        q = self.robot.joint_angles
        line = f"GOTO {name}  ; J=[{', '.join(f'{v:.1f}' for v in q)}]"
        cursor = self._editor.textCursor()
        cursor.insertText("\n" + line)
        self._log_message(f"📍 Punto '{name}' enseñado")

    def _goto_point(self, item: QListWidgetItem):
        """Doble clic → mover robot al punto seleccionado."""
        name = item.data(Qt.ItemDataRole.UserRole)
        if name in self.taught_points:
            self.robot.set_joints(self.taught_points[name])
            self.comm.send_joints(self.robot.joint_angles)
            self.robot_moved.emit()

    def _delete_point(self):
        item = self._points_list.currentItem()
        if item:
            name = item.data(Qt.ItemDataRole.UserRole)
            del self.taught_points[name]
            self._update_points_list()

    def _update_points_list(self):
        self._points_list.clear()
        for name, q in self.taught_points.items():
            item = QListWidgetItem(
                f"{name}\n  [{', '.join(f'{v:.1f}°' for v in q)}]"
            )
            item.setData(Qt.ItemDataRole.UserRole, name)
            self._points_list.addItem(item)

    def teach_current_point(self):
        """Llamado externamente desde el panel de jog."""
        self._teach_point()

    # ------------------------------------------------------------------ #
    # Log                                                                  #
    # ------------------------------------------------------------------ #

    def _log_message(self, msg: str):
        import time as _time
        ts = _time.strftime("%H:%M:%S")
        self._log.append(f'<span style="color:#506070">[{ts}]</span> {msg}')
        self._log.verticalScrollBar().setValue(
            self._log.verticalScrollBar().maximum()
        )
