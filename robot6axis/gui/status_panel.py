"""
Panel de estado: visualiza ángulos articulares y posición del TCP.
Estilo ABB FlexPendant.
"""

import numpy as np
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QFrame, QGroupBox, QGridLayout, QProgressBar
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont


class ValueDisplay(QWidget):
    """Display de una sola variable con etiqueta y valor numérico."""

    def __init__(self, label: str, unit: str = "", parent=None):
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(4)

        self._lbl = QLabel(label)
        self._lbl.setFixedWidth(90)
        self._lbl.setStyleSheet("color: #8090a0; font-size: 12px;")
        layout.addWidget(self._lbl)

        self._value = QLabel("0.00")
        self._value.setStyleSheet(
            "color: #00ff88; font-family: 'Courier New'; font-size: 14px; font-weight: bold;"
        )
        self._value.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self._value.setMinimumWidth(70)
        layout.addWidget(self._value)

        if unit:
            qlbl = QLabel(unit)
            qlbl.setStyleSheet("color: #507090; font-size: 11px;")
            qlbl.setFixedWidth(25)
            layout.addWidget(qlbl)

        # Barra de progreso para rango articular
        self._bar = QProgressBar()
        self._bar.setRange(-1000, 1000)
        self._bar.setValue(0)
        self._bar.setFixedHeight(4)
        self._bar.setTextVisible(False)
        self._bar.setStyleSheet("""
            QProgressBar { background: #0f3460; border: none; border-radius: 2px; }
            QProgressBar::chunk { background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                stop:0 #0078d4, stop:1 #00c0ff); border-radius: 2px; }
        """)
        layout.addWidget(self._bar, 1)

        self._unit = unit
        self._range = (-180, 180)

    def set_range(self, min_val: float, max_val: float):
        self._range = (min_val, max_val)
        self._bar.setRange(int(min_val * 10), int(max_val * 10))

    def set_value(self, val: float):
        self._value.setText(f"{val:+8.2f}")
        self._bar.setValue(int(val * 10))

        # Color según proximidad a límites
        ratio = abs(val) / max(abs(self._range[0]), abs(self._range[1]), 1)
        if ratio > 0.9:
            color = "#ff4444"
        elif ratio > 0.7:
            color = "#ffaa00"
        else:
            color = "#00ff88"
        self._value.setStyleSheet(
            f"color: {color}; font-family: 'Courier New'; font-size: 14px; font-weight: bold;"
        )


class StatusPanel(QWidget):
    """Panel de estado del robot con posiciones articulares y TCP."""

    def __init__(self, robot, parent=None):
        super().__init__(parent)
        self.robot = robot
        self._setup_ui()
        self.refresh()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(8)

        # ---- Articulaciones ---- #
        joints_box = QGroupBox("ARTICULACIONES")
        joints_layout = QVBoxLayout(joints_box)
        joints_layout.setSpacing(2)

        self._joint_displays = []
        labels = ["J1 - Base", "J2 - Hombro", "J3 - Codo",
                  "J4 - Muñeca 1", "J5 - Muñeca 2", "J6 - Muñeca 3"]

        for i, name in enumerate(labels):
            disp = ValueDisplay(name, "°")
            lo, hi = self.robot.limits[i]
            disp.set_range(lo, hi)
            joints_layout.addWidget(disp)
            self._joint_displays.append(disp)

        layout.addWidget(joints_box)

        # ---- Posición TCP ---- #
        tcp_box = QGroupBox("POSICIÓN TCP")
        tcp_layout = QVBoxLayout(tcp_box)
        tcp_layout.setSpacing(2)

        self._tcp_displays = []
        tcp_labels = [("X", "mm"), ("Y", "mm"), ("Z", "mm"),
                      ("Rx", "°"), ("Ry", "°"), ("Rz", "°")]

        for name, unit in tcp_labels:
            disp = ValueDisplay(name, unit)
            r = 800 if unit == "mm" else 360
            disp.set_range(-r, r)
            tcp_layout.addWidget(disp)
            self._tcp_displays.append(disp)

        layout.addWidget(tcp_box)
        layout.addStretch()

    def refresh(self):
        """Actualiza todos los valores mostrados."""
        q = self.robot.joint_angles
        tcp = self.robot.tcp_pose

        for i, disp in enumerate(self._joint_displays):
            disp.set_value(q[i])

        for i, disp in enumerate(self._tcp_displays):
            disp.set_value(tcp[i])
