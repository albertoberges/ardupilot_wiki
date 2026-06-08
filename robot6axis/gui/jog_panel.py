"""
Panel de jog: control manual del robot al estilo FlexPendant de ABB.
Soporta jog articular y cartesiano con control de velocidad.
"""

import numpy as np
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QPushButton, QLabel, QSlider, QComboBox, QGroupBox, QFrame
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont
from gui.styles import JOG_BTN_STYLE


class JogButton(QPushButton):
    """Botón de jog: emite señales mientras se mantiene presionado."""

    jog_active = pyqtSignal(bool)  # True = activo, False = liberado

    def __init__(self, text: str, parent=None):
        super().__init__(text, parent)
        self.setStyleSheet(JOG_BTN_STYLE)
        self.setAutoRepeat(False)

    def mousePressEvent(self, e):
        super().mousePressEvent(e)
        self.jog_active.emit(True)

    def mouseReleaseEvent(self, e):
        super().mouseReleaseEvent(e)
        self.jog_active.emit(False)

    def keyPressEvent(self, e):
        if e.key() == Qt.Key.Key_Space and not e.isAutoRepeat():
            self.jog_active.emit(True)
        super().keyPressEvent(e)

    def keyReleaseEvent(self, e):
        if e.key() == Qt.Key.Key_Space:
            self.jog_active.emit(False)
        super().keyReleaseEvent(e)


class JogPanel(QWidget):
    """
    Panel de control manual del robot.
    Soporta dos modos:
      - Articular: jog de cada eje individualmente
      - Cartesiano: jog X/Y/Z y rotaciones Rx/Ry/Rz
    """

    # Señal emitida cada vez que el robot se mueve
    robot_moved = pyqtSignal()

    # Velocidad base en grados/paso (escala con el slider)
    BASE_STEP_DEG = 1.0
    BASE_STEP_MM = 5.0
    JOG_RATE_MS = 50  # Intervalo del timer en ms

    def __init__(self, robot, comm_manager, parent=None):
        super().__init__(parent)
        self.robot = robot
        self.comm = comm_manager
        self._jog_action = None  # Acción activa: (type, axis, direction)
        self._estop = False

        self._setup_ui()
        self._jog_timer = QTimer(self)
        self._jog_timer.setInterval(self.JOG_RATE_MS)
        self._jog_timer.timeout.connect(self._do_jog_step)

    # ------------------------------------------------------------------ #
    # UI                                                                   #
    # ------------------------------------------------------------------ #

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(10)

        # ---- Modo de jog ---- #
        mode_box = QGroupBox("MODO DE JOG")
        mode_layout = QVBoxLayout(mode_box)

        mode_row = QHBoxLayout()
        self._mode_combo = QComboBox()
        self._mode_combo.addItems(["Articular", "Cartesiano"])
        self._mode_combo.currentIndexChanged.connect(self._on_mode_change)
        mode_row.addWidget(QLabel("Tipo:"))
        mode_row.addWidget(self._mode_combo)
        mode_layout.addLayout(mode_row)

        layout.addWidget(mode_box)

        # ---- Velocidad / Paso ---- #
        speed_box = QGroupBox("VELOCIDAD DE JOG")
        speed_layout = QVBoxLayout(speed_box)

        self._speed_slider = QSlider(Qt.Orientation.Horizontal)
        self._speed_slider.setRange(1, 100)
        self._speed_slider.setValue(25)
        self._speed_slider.setTickInterval(25)
        self._speed_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        speed_layout.addWidget(self._speed_slider)

        self._speed_label = QLabel("25%")
        self._speed_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._speed_label.setStyleSheet(
            "color: #00ff88; font-size: 20px; font-weight: bold;"
        )
        self._speed_slider.valueChanged.connect(
            lambda v: self._speed_label.setText(f"{v}%")
        )
        speed_layout.addWidget(self._speed_label)

        layout.addWidget(speed_box)

        # ---- Área de botones de jog (stacked) ---- #
        self._jog_joint_widget = self._build_joint_jog()
        self._jog_cart_widget = self._build_cart_jog()
        self._jog_cart_widget.setVisible(False)

        layout.addWidget(self._jog_joint_widget)
        layout.addWidget(self._jog_cart_widget)

        # ---- Botones de acción ---- #
        action_box = QGroupBox("ACCIONES")
        action_layout = QGridLayout(action_box)
        action_layout.setSpacing(6)

        home_btn = QPushButton("⌂  HOME")
        home_btn.setProperty("class", "home")
        home_btn.setStyleSheet("""
            QPushButton[class="home"] {
                background-color: #30005a; border: 2px solid #8040c0;
                color: #c080ff; font-weight: bold; font-size: 13px;
                padding: 8px; border-radius: 4px; min-height: 40px;
            }
            QPushButton[class="home"]:hover { background-color: #5000a0; }
        """)
        home_btn.clicked.connect(self._go_home)
        action_layout.addWidget(home_btn, 0, 0, 1, 2)

        teach_btn = QPushButton("📍  TEACH")
        teach_btn.setProperty("class", "success")
        teach_btn.setStyleSheet("""
            QPushButton {
                background-color: #004d20; border: 1px solid #007a33;
                color: #80ffb0; font-weight: bold; font-size: 13px;
                padding: 8px; border-radius: 4px; min-height: 40px;
            }
            QPushButton:hover { background-color: #007a33; color: white; }
        """)
        teach_btn.clicked.connect(self.teach_requested)
        action_layout.addWidget(teach_btn, 1, 0)

        open_grip_btn = QPushButton("✋  ABRIR")
        open_grip_btn.setStyleSheet("""
            QPushButton {
                background-color: #2a1a00; border: 1px solid #7a5000;
                color: #ffc060; font-size: 13px; padding: 8px;
                border-radius: 4px; min-height: 40px;
            }
            QPushButton:hover { background-color: #5a3000; }
        """)
        open_grip_btn.clicked.connect(lambda: self._gripper(False))
        action_layout.addWidget(open_grip_btn, 1, 1)

        layout.addWidget(action_box)
        layout.addStretch()

    def _build_joint_jog(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        names = ["J1", "J2", "J3", "J4", "J5", "J6"]
        colors = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#a8dadc", "#ccccff"]

        for i, (name, color) in enumerate(zip(names, colors)):
            row = QHBoxLayout()
            row.setSpacing(4)

            lbl = QLabel(name)
            lbl.setFixedWidth(30)
            lbl.setStyleSheet(f"color: {color}; font-weight: bold; font-size: 13px;")
            row.addWidget(lbl)

            minus_btn = JogButton("−")
            plus_btn = JogButton("+")

            minus_btn.jog_active.connect(
                lambda active, idx=i: self._set_jog("joint", idx, -1, active)
            )
            plus_btn.jog_active.connect(
                lambda active, idx=i: self._set_jog("joint", idx, +1, active)
            )

            row.addWidget(minus_btn)
            row.addWidget(plus_btn)
            layout.addLayout(row)

        return widget

    def _build_cart_jog(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        axes = [
            ("X", 0, "#ff4444"), ("Y", 1, "#44ff44"), ("Z", 2, "#4444ff"),
            ("Rx", 3, "#ff8888"), ("Ry", 4, "#88ff88"), ("Rz", 5, "#8888ff"),
        ]

        for name, idx, color in axes:
            row = QHBoxLayout()
            lbl = QLabel(name)
            lbl.setFixedWidth(30)
            lbl.setStyleSheet(f"color: {color}; font-weight: bold; font-size: 13px;")
            row.addWidget(lbl)

            minus_btn = JogButton("−")
            plus_btn = JogButton("+")
            minus_btn.jog_active.connect(
                lambda active, ax=idx: self._set_jog("cart", ax, -1, active)
            )
            plus_btn.jog_active.connect(
                lambda active, ax=idx: self._set_jog("cart", ax, +1, active)
            )
            row.addWidget(minus_btn)
            row.addWidget(plus_btn)
            layout.addLayout(row)

        return widget

    # ------------------------------------------------------------------ #
    # Lógica de jog                                                        #
    # ------------------------------------------------------------------ #

    def _set_jog(self, jog_type: str, axis: int, direction: int, active: bool):
        """Activa o desactiva el jog."""
        if self._estop:
            return
        if active:
            self._jog_action = (jog_type, axis, direction)
            self._jog_timer.start()
        else:
            self._jog_action = None
            self._jog_timer.stop()

    def _do_jog_step(self):
        """Ejecuta un paso de jog (llamado por el timer)."""
        if not self._jog_action or self._estop:
            self._jog_timer.stop()
            return

        jog_type, axis, direction = self._jog_action
        speed_factor = self._speed_slider.value() / 100.0

        if jog_type == "joint":
            delta = self.BASE_STEP_DEG * speed_factor * direction
            self.robot.jog_joint(axis, delta)
        else:
            delta_xyz = np.zeros(3)
            if axis < 3:
                delta_xyz[axis] = self.BASE_STEP_MM * speed_factor * direction
                self.robot.jog_cartesian(delta_xyz)
            # Rotaciones cartesianas - se pueden implementar con IK de orientación

        self.comm.send_joints(self.robot.joint_angles)
        self.robot_moved.emit()

    def _on_mode_change(self, idx: int):
        is_joint = idx == 0
        self._jog_joint_widget.setVisible(is_joint)
        self._jog_cart_widget.setVisible(not is_joint)

    def _go_home(self):
        """Mueve el robot a la posición home."""
        if self._estop:
            return
        self.robot.move_home()
        self.comm.send_home()
        self.robot_moved.emit()

    def teach_requested(self):
        """Señal de enseñar punto - manejado por ventana principal."""
        pass  # Conectado externamente desde main_window

    def _gripper(self, close: bool):
        """Controla la pinza."""
        pass  # Implementar según hardware

    def set_estop(self, active: bool):
        """Activa o desactiva la parada de emergencia."""
        self._estop = active
        if active:
            self._jog_action = None
            self._jog_timer.stop()
        self._jog_joint_widget.setEnabled(not active)
        self._jog_cart_widget.setEnabled(not active)
