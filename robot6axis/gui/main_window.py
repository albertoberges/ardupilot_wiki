"""
Ventana principal del controlador de robot de 6 ejes.
Diseño estilo ABB RobotStudio: panels acoplables, barra de herramientas y vista 3D.
"""

import numpy as np
from PyQt6.QtWidgets import (
    QMainWindow, QDockWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QStatusBar, QToolBar, QComboBox,
    QSplitter, QFrame, QSizePolicy, QMessageBox, QDialog,
    QGridLayout, QSlider, QApplication, QStackedWidget, QTabWidget
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QSize
from PyQt6.QtGui import QAction, QFont, QColor, QIcon

from kinematics.robot import Robot6DOF
from communication.serial_manager import SimulatedSerial, SerialManager
from gui.robot_view import RobotView3D
from gui.status_panel import StatusPanel
from gui.jog_panel import JogPanel
from gui.program_panel import ProgramPanel
from gui.vision_panel import VisionPanel
from gui.styles import MAIN_STYLE, ESTOP_STYLE


class EstopButton(QPushButton):
    """Botón de parada de emergencia con animación de parpadeo."""

    def __init__(self, parent=None):
        super().__init__("PARO\nEMERGENCIA", parent)
        self.setStyleSheet(ESTOP_STYLE)
        self.setCheckable(True)
        self._blink_timer = QTimer(self)
        self._blink_timer.timeout.connect(self._blink)
        self._blink_state = False

    def set_active(self, active: bool):
        self.setChecked(active)
        if active:
            self._blink_timer.start(400)
        else:
            self._blink_timer.stop()
            self.setStyleSheet(ESTOP_STYLE)

    def _blink(self):
        self._blink_state = not self._blink_state
        bg = "#ff0000" if self._blink_state else "#880000"
        self.setStyleSheet(ESTOP_STYLE + f"\nQPushButton:checked {{ background-color: {bg}; }}")


class ConnectionBar(QWidget):
    """Barra de conexión con selector de puerto y botón de conexión."""

    connected = pyqtSignal(bool)

    def __init__(self, comm_manager, parent=None):
        super().__init__(parent)
        self.comm = comm_manager
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        layout.addWidget(QLabel("Puerto:"))

        self._port_combo = QComboBox()
        self._port_combo.setMinimumWidth(160)
        layout.addWidget(self._port_combo)

        self._refresh_btn = QPushButton("↻")
        self._refresh_btn.setFixedWidth(36)
        self._refresh_btn.setToolTip("Refrescar puertos")
        self._refresh_btn.clicked.connect(self._refresh_ports)
        layout.addWidget(self._refresh_btn)

        self._connect_btn = QPushButton("Conectar")
        self._connect_btn.setMinimumWidth(90)
        self._connect_btn.clicked.connect(self._toggle_connect)
        layout.addWidget(self._connect_btn)

        self._status_lbl = QLabel("⚫  Sin conexión")
        self._status_lbl.setStyleSheet("color: #888888; font-size: 12px;")
        layout.addWidget(self._status_lbl)

        self._refresh_ports()
        self.comm.set_status_callback(self._on_comm_status)

    def _refresh_ports(self):
        self._port_combo.clear()
        ports = SimulatedSerial.list_ports()
        real_ports = SerialManager.list_ports() if SerialManager else []
        all_ports = real_ports + ["SIM - Simulador"]
        self._port_combo.addItems(all_ports)

    def _toggle_connect(self):
        if self.comm.connected:
            self.comm.disconnect()
            self._connect_btn.setText("Conectar")
            self._status_lbl.setText("⚫  Sin conexión")
            self._status_lbl.setStyleSheet("color: #888888; font-size: 12px;")
            self.connected.emit(False)
        else:
            port = self._port_combo.currentText()
            ok = self.comm.connect(port)
            if ok:
                self._connect_btn.setText("Desconectar")
                self._status_lbl.setText(f"🟢  {port}")
                self._status_lbl.setStyleSheet("color: #00ff88; font-size: 12px;")
                self.connected.emit(True)

    def _on_comm_status(self, msg: str):
        self._status_lbl.setText(f"ℹ  {msg[:50]}")


class ModeIndicator(QWidget):
    """Indicador de modo (Manual / Automático / Remoto)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        layout.addWidget(QLabel("MODO:"))

        self._mode_btn = QPushButton("MANUAL")
        self._mode_btn.setCheckable(False)
        self._mode_btn.setStyleSheet("""
            QPushButton {
                background-color: #004080; color: #60c0ff;
                border: 2px solid #0060b0; border-radius: 4px;
                font-weight: bold; font-size: 13px; padding: 4px 12px;
                min-width: 90px;
            }
        """)
        layout.addWidget(self._mode_btn)

        self._modes = ["MANUAL", "AUTOMÁTICO", "REMOTO"]
        self._mode_colors = ["#004080/#60c0ff/#0060b0",
                              "#004000/#60ff60/#006000",
                              "#400060/#c060ff/#600090"]
        self._idx = 0
        self._mode_btn.clicked.connect(self._cycle_mode)

    def _cycle_mode(self):
        self._idx = (self._idx + 1) % len(self._modes)
        name = self._modes[self._idx]
        bg, fg, border = self._mode_colors[self._idx].split("/")
        self._mode_btn.setText(name)
        self._mode_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg}; color: {fg};
                border: 2px solid {border}; border-radius: 4px;
                font-weight: bold; font-size: 13px; padding: 4px 12px;
                min-width: 90px;
            }}
        """)

    @property
    def current_mode(self) -> str:
        return self._modes[self._idx]


class MainWindow(QMainWindow):
    """Ventana principal del controlador de robot de 6 ejes."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Robot 6 Ejes — Controlador  |  v1.0")
        self.resize(1400, 900)

        # ---- Objetos principales ---- #
        self.robot = Robot6DOF()
        self.comm = SimulatedSerial()
        self.comm.connect("SIM")

        self._estop_active = False

        self._setup_ui()
        self._setup_menu()
        self._setup_status_bar()
        self._apply_styles()

        # Timer de actualización de UI
        self._update_timer = QTimer(self)
        self._update_timer.timeout.connect(self._refresh_ui)
        self._update_timer.start(50)  # 20 Hz

    # ------------------------------------------------------------------ #
    # Construcción de la UI                                                #
    # ------------------------------------------------------------------ #

    def _setup_ui(self):
        # ---- Barra de herramientas principal ---- #
        self._toolbar = QToolBar("Principal")
        self._toolbar.setMovable(False)
        self._toolbar.setIconSize(QSize(24, 24))
        self._toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.addToolBar(self._toolbar)

        # Botón de parada de emergencia
        self._estop_btn = EstopButton()
        self._estop_btn.setFixedSize(120, 70)
        self._estop_btn.toggled.connect(self._toggle_estop)
        self._toolbar.addWidget(self._estop_btn)
        self._toolbar.addSeparator()

        # Indicador de modo
        self._mode_indicator = ModeIndicator()
        self._toolbar.addWidget(self._mode_indicator)
        self._toolbar.addSeparator()

        # Barra de conexión
        self._conn_bar = ConnectionBar(self.comm)
        self._toolbar.addWidget(self._conn_bar)
        self._toolbar.addSeparator()

        # Velocidad global
        speed_widget = QWidget()
        speed_layout = QHBoxLayout(speed_widget)
        speed_layout.setContentsMargins(8, 0, 8, 0)
        speed_layout.setSpacing(6)
        speed_layout.addWidget(QLabel("VEL GLOBAL:"))
        self._global_speed_slider = QSlider(Qt.Orientation.Horizontal)
        self._global_speed_slider.setRange(1, 100)
        self._global_speed_slider.setValue(50)
        self._global_speed_slider.setFixedWidth(120)
        self._global_speed_lbl = QLabel("50%")
        self._global_speed_lbl.setStyleSheet(
            "color: #00ff88; font-weight: bold; min-width: 35px;"
        )
        self._global_speed_slider.valueChanged.connect(
            lambda v: self._global_speed_lbl.setText(f"{v}%")
        )
        speed_layout.addWidget(self._global_speed_slider)
        speed_layout.addWidget(self._global_speed_lbl)
        self._toolbar.addWidget(speed_widget)

        # ================================================================ #
        # Layout principal: barra lateral de navegación + área de vistas  #
        # ================================================================ #
        root = QWidget()
        root_layout = QHBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # ---- Barra lateral izquierda de navegación ---- #
        nav_bar = self._build_nav_bar()
        root_layout.addWidget(nav_bar)

        # ---- Stack de vistas (cambia según el botón pulsado) ---- #
        self._stack = QStackedWidget()
        root_layout.addWidget(self._stack, 1)

        # ── Vista 0: Control del robot (3D + Jog + Programa) ── #
        control_view = QWidget()
        cv_layout = QVBoxLayout(control_view)
        cv_layout.setContentsMargins(0, 0, 0, 0)
        cv_layout.setSpacing(0)

        h_splitter = QSplitter(Qt.Orientation.Horizontal)
        self._robot_view = RobotView3D(self.robot)
        h_splitter.addWidget(self._robot_view)

        self._jog_panel = JogPanel(self.robot, self.comm)
        self._jog_panel.robot_moved.connect(self._on_robot_moved)
        self._jog_panel.setMinimumWidth(230)
        self._jog_panel.setMaximumWidth(310)
        h_splitter.addWidget(self._jog_panel)
        h_splitter.setSizes([1000, 280])

        self._program_panel = ProgramPanel(self.robot, self.comm)
        self._program_panel.robot_moved.connect(self._on_robot_moved)
        self._program_panel.setMinimumHeight(180)
        self._program_panel.setMaximumHeight(340)

        v_splitter = QSplitter(Qt.Orientation.Vertical)
        v_splitter.setHandleWidth(6)
        v_splitter.setStyleSheet("""
            QSplitter::handle:vertical {
                background: #0078d4; height: 6px;
                border-radius: 3px; margin: 1px 40px;
            }
            QSplitter::handle:vertical:hover { background: #00aaff; }
        """)
        v_splitter.addWidget(h_splitter)
        v_splitter.addWidget(self._program_panel)
        v_splitter.setSizes([650, 250])
        v_splitter.setCollapsible(0, False)
        v_splitter.setCollapsible(1, False)

        cv_layout.addWidget(v_splitter)
        self._stack.addWidget(control_view)       # índice 0

        # ── Vista 1: Estado del robot (posición detallada) ── #
        self._status_panel = StatusPanel(self.robot)
        status_scroll = QWidget()
        ss_layout = QVBoxLayout(status_scroll)
        ss_layout.setContentsMargins(12, 12, 12, 12)
        ss_layout.addWidget(self._status_panel)
        ss_layout.addStretch()
        self._stack.addWidget(status_scroll)      # índice 1

        # ── Vista 2: Visión IA (pantalla completa) ── #
        self._vision_panel = VisionPanel(self.robot, self.comm)
        self._vision_panel.robot_moved.connect(self._on_robot_moved)
        self._stack.addWidget(self._vision_panel) # índice 2

        self._stack.setCurrentIndex(0)
        self.setCentralWidget(root)

        # Conectar teach desde jog panel
        self._jog_panel.teach_requested = self._program_panel.teach_current_point

    def _build_nav_bar(self) -> QWidget:
        """Barra lateral izquierda con botones de navegación entre vistas."""
        bar = QWidget()
        bar.setFixedWidth(72)
        bar.setStyleSheet("""
            QWidget {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #0a1628, stop:1 #0f2040);
                border-right: 2px solid #0078d4;
            }
        """)
        layout = QVBoxLayout(bar)
        layout.setContentsMargins(6, 12, 6, 12)
        layout.setSpacing(6)

        self._nav_buttons = []
        nav_items = [
            ("🤖", "Control\nRobot",  0, "#0078d4"),
            ("📊", "Estado",          1, "#00aa88"),
            ("📷", "Visión\nIA",      2, "#9040e0"),
        ]

        for icon, label, idx, color in nav_items:
            btn = QPushButton(f"{icon}\n{label}")
            btn.setCheckable(True)
            btn.setFixedSize(60, 68)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background: transparent;
                    color: #507090;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 4px 2px;
                }}
                QPushButton:hover {{
                    background: #0f2850;
                    color: #a0c0e0;
                    border-color: #1a4a8a;
                }}
                QPushButton:checked {{
                    background: {color}22;
                    color: {color};
                    border: 2px solid {color};
                }}
            """)
            btn.clicked.connect(lambda _, i=idx: self._switch_view(i))
            layout.addWidget(btn)
            self._nav_buttons.append(btn)

        layout.addStretch()

        # Versión al pie
        ver = QLabel("v1.0")
        ver.setAlignment(Qt.AlignmentFlag.AlignCenter)
        ver.setStyleSheet("color: #2a4060; font-size: 10px;")
        layout.addWidget(ver)

        self._nav_buttons[0].setChecked(True)
        return bar

    def _switch_view(self, idx: int):
        """Cambia la vista activa y actualiza el estado de los botones."""
        self._stack.setCurrentIndex(idx)
        for i, btn in enumerate(self._nav_buttons):
            btn.setChecked(i == idx)

    def _setup_menu(self):
        menubar = self.menuBar()

        # ---- Archivo ---- #
        file_menu = menubar.addMenu("Archivo")
        file_menu.addAction("Nuevo programa", self._new_program)
        file_menu.addAction("Abrir programa...", self._open_program)
        file_menu.addAction("Guardar programa...", self._save_program)
        file_menu.addSeparator()
        file_menu.addAction("Salir", self.close)

        # ---- Robot ---- #
        robot_menu = menubar.addMenu("Robot")
        robot_menu.addAction("Ir a HOME", lambda: self.robot.move_home())
        robot_menu.addAction("Calibrar...", self._show_calibration)
        robot_menu.addSeparator()
        robot_menu.addAction("Configuración DH...", self._show_dh_config)

        # ---- Vista ---- #
        view_menu = menubar.addMenu("Vista")
        view_menu.addAction("Restablecer vista 3D", self._reset_view)

        # ---- Ayuda ---- #
        help_menu = menubar.addMenu("Ayuda")
        help_menu.addAction("Instrucciones del lenguaje", self._show_help)
        help_menu.addAction("Acerca de...", self._show_about)

    def _setup_status_bar(self):
        sb = self.statusBar()
        self._sb_mode = QLabel("MANUAL")
        self._sb_mode.setStyleSheet("color: #60c0ff; font-weight: bold; padding: 0 8px;")
        sb.addPermanentWidget(self._sb_mode)

        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.VLine)
        sep.setStyleSheet("color: #0f3460;")
        sb.addPermanentWidget(sep)

        self._sb_conn = QLabel("🟢 Simulador")
        self._sb_conn.setStyleSheet("color: #00ff88; padding: 0 8px;")
        sb.addPermanentWidget(self._sb_conn)

        sep2 = QFrame()
        sep2.setFrameShape(QFrame.Shape.VLine)
        sep2.setStyleSheet("color: #0f3460;")
        sb.addPermanentWidget(sep2)

        self._sb_tcp = QLabel("")
        self._sb_tcp.setStyleSheet(
            "color: #7ec8e3; font-family: 'Courier New'; padding: 0 8px;"
        )
        sb.addPermanentWidget(self._sb_tcp)

        sb.showMessage("Sistema listo.", 3000)

    def _apply_styles(self):
        from gui.styles import MAIN_STYLE
        self.setStyleSheet(MAIN_STYLE)

    # ------------------------------------------------------------------ #
    # Señales y actualización                                              #
    # ------------------------------------------------------------------ #

    def _on_robot_moved(self):
        """Actualiza la vista 3D y el panel de estado."""
        self._robot_view.update_robot()
        self._status_panel.refresh()
        tcp = self.robot.tcp_pose
        self._sb_tcp.setText(
            f"TCP  X:{tcp[0]:.1f}  Y:{tcp[1]:.1f}  Z:{tcp[2]:.1f} mm  "
            f"Rx:{tcp[3]:.1f}  Ry:{tcp[4]:.1f}  Rz:{tcp[5]:.1f}°"
        )

    def _refresh_ui(self):
        """Actualización periódica ligera."""
        self._sb_mode.setText(self._mode_indicator.current_mode)

    def _toggle_estop(self, active: bool):
        self._estop_active = active
        self._estop_btn.set_active(active)
        self._jog_panel.set_estop(active)
        if active:
            self.comm.send_estop()
            self.statusBar().showMessage("⚠ PARO DE EMERGENCIA ACTIVADO", 0)
            self.statusBar().setStyleSheet(
                "background-color: #5a0000; color: #ff8080; border-top: 2px solid #ff0000;"
            )
        else:
            self.comm.send_enable()
            self.statusBar().showMessage("Sistema reanudado.", 3000)
            self.statusBar().setStyleSheet("")
            self._apply_styles()

    # ------------------------------------------------------------------ #
    # Acciones de menú                                                     #
    # ------------------------------------------------------------------ #

    def _new_program(self):
        self._program_panel._editor.setPlainText("; Nuevo programa\nHOME\n")

    def _open_program(self):
        from PyQt6.QtWidgets import QFileDialog
        path, _ = QFileDialog.getOpenFileName(
            self, "Abrir programa", "", "Programas Robot (*.rob *.txt);;Todos (*.*)"
        )
        if path:
            with open(path, "r") as f:
                self._program_panel._editor.setPlainText(f.read())

    def _save_program(self):
        from PyQt6.QtWidgets import QFileDialog
        path, _ = QFileDialog.getSaveFileName(
            self, "Guardar programa", "programa.rob",
            "Programas Robot (*.rob);;Texto (*.txt)"
        )
        if path:
            with open(path, "w") as f:
                f.write(self._program_panel._editor.toPlainText())

    def _show_calibration(self):
        QMessageBox.information(
            self, "Calibración",
            "Coloque el robot en posición de calibración (todos los ejes a 0°)\n"
            "y confirme para establecer el cero de cada articulación."
        )

    def _show_dh_config(self):
        msg = "Parámetros DH del robot (similar a ABB IRB 120):\n\n"
        msg += f"{'Eje':<6} {'a(mm)':<10} {'d(mm)':<10} {'alpha(°)':<12} {'offset(°)':<10}\n"
        msg += "-" * 50 + "\n"
        labels = ["J1", "J2", "J3", "J4", "J5", "J6"]
        import numpy as np
        for i, (a, d, alpha, t_off) in enumerate(self.robot.dh):
            msg += (f"{labels[i]:<6} {a:<10.1f} {d:<10.1f} "
                    f"{np.degrees(alpha):<12.1f} {np.degrees(t_off):<10.1f}\n")
        QMessageBox.information(self, "Configuración DH", msg)

    def _reset_view(self):
        self._robot_view.ax.view_init(elev=25, azim=45)
        self._robot_view.canvas.draw_idle()

    def _show_help(self):
        help_text = """
LENGUAJE DE PROGRAMACIÓN DEL ROBOT
====================================

INSTRUCCIONES DE MOVIMIENTO:
  HOME                      → Mover a posición cero
  MOVJ J1 J2 J3 J4 J5 J6 V<vel>   → Movimiento articular
  MOVL X Y Z V<vel>         → Movimiento cartesiano lineal
  GOTO <nombre_punto>        → Ir a punto enseñado

CONTROL:
  WAIT <segundos>           → Esperar tiempo
  LOOP <n>                  → Repetir n veces
  END                       → Fin del bucle
  SET DO<n> <0|1>           → Controlar salida digital

COMENTARIOS:
  ; Este es un comentario

VELOCIDAD:
  V10 = 10%, V50 = 50%, V100 = 100% de la velocidad

EJEMPLO:
  HOME
  MOVJ 45 -30 60 0 30 0 V50
  WAIT 1.0
  GOTO pPick
  HOME
"""
        msg = QMessageBox(self)
        msg.setWindowTitle("Ayuda - Instrucciones del lenguaje")
        msg.setText(help_text)
        msg.setFont(QFont("Courier New", 11))
        msg.exec()

    def _show_about(self):
        QMessageBox.about(
            self, "Acerca de",
            "Robot 6 Ejes — Controlador v1.0\n\n"
            "Sistema de control para robot industrial de 6 grados de libertad.\n"
            "Interfaz estilo ABB RobotStudio / FlexPendant.\n\n"
            "Características:\n"
            "• Cinemática directa e inversa (DH)\n"
            "• Jog articular y cartesiano\n"
            "• Editor de programas con resaltado de sintaxis\n"
            "• Puntos enseñados\n"
            "• Visualización 3D en tiempo real\n"
            "• Comunicación serie con Arduino"
        )
