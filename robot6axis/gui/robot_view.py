"""
Visualización 3D del robot con matplotlib embebido en PyQt6.
"""

import numpy as np
import matplotlib
matplotlib.use("QtAgg")

import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Line3DCollection
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QSizePolicy
from PyQt6.QtCore import Qt


class RobotView3D(QWidget):
    """Widget de visualización 3D del robot de 6 ejes."""

    # Colores de los eslabones
    LINK_COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#a8dadc", "#ffffff"]
    JOINT_COLOR = "#ffd700"
    TCP_COLORS = ["#ff4444", "#44ff44", "#4444ff"]  # X=R, Y=G, Z=B

    def __init__(self, robot, parent=None):
        super().__init__(parent)
        self.robot = robot
        self._setup_ui()
        self.update_robot()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.figure = Figure(facecolor="#0d1117")
        self.canvas = FigureCanvasQTAgg(self.figure)
        self.canvas.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        self.ax = self.figure.add_subplot(111, projection="3d")
        self._style_axes()

        layout.addWidget(self.canvas)
        self.setMinimumSize(400, 350)

    def _style_axes(self):
        ax = self.ax
        ax.set_facecolor("#0d1117")
        self.figure.patch.set_facecolor("#0d1117")

        ax.xaxis.pane.fill = False
        ax.yaxis.pane.fill = False
        ax.zaxis.pane.fill = False
        ax.xaxis.pane.set_edgecolor("#0f3460")
        ax.yaxis.pane.set_edgecolor("#0f3460")
        ax.zaxis.pane.set_edgecolor("#0f3460")

        ax.grid(True, color="#0f3460", linewidth=0.5, alpha=0.5)
        ax.tick_params(colors="#7ec8e3", labelsize=8)
        ax.xaxis.label.set_color("#7ec8e3")
        ax.yaxis.label.set_color("#7ec8e3")
        ax.zaxis.label.set_color("#7ec8e3")

        for spine in [ax.xaxis, ax.yaxis, ax.zaxis]:
            spine.line.set_color("#0f3460")

        ax.set_xlabel("X (mm)", fontsize=9, color="#7ec8e3")
        ax.set_ylabel("Y (mm)", fontsize=9, color="#7ec8e3")
        ax.set_zlabel("Z (mm)", fontsize=9, color="#7ec8e3")

    def update_robot(self, q_deg=None):
        """Redibuja el robot con los ángulos dados."""
        ax = self.ax

        # Guardar posición de cámara antes de limpiar
        elev = ax.elev
        azim = ax.azim
        dist = getattr(ax, "dist", 10.0)

        ax.cla()
        self._style_axes()

        positions = self.robot.get_link_positions(q_deg)  # (7, 3)
        transforms = self.robot.get_all_transforms(q_deg)

        # Dibujar eslabones
        for i in range(len(positions) - 1):
            p0 = positions[i]
            p1 = positions[i + 1]
            color = self.LINK_COLORS[i % len(self.LINK_COLORS)]
            ax.plot([p0[0], p1[0]], [p0[1], p1[1]], [p0[2], p1[2]],
                    color=color, linewidth=6, solid_capstyle="round", zorder=5)

        # Dibujar articulaciones
        for i, pos in enumerate(positions):
            size = 60 if i == 0 else 40
            color = self.JOINT_COLOR
            ax.scatter(*pos, s=size, c=color, zorder=10, depthshade=False)

        # Dibujar sistema de referencia del TCP
        tcp_T = transforms[-1]
        tcp_pos = tcp_T[:3, 3]
        scale = 60
        labels = ["X", "Y", "Z"]
        for j, (col, lbl) in enumerate(zip(self.TCP_COLORS, labels)):
            direction = tcp_T[:3, j]
            end = tcp_pos + direction * scale
            ax.plot([tcp_pos[0], end[0]], [tcp_pos[1], end[1]],
                    [tcp_pos[2], end[2]], color=col, linewidth=2.5, zorder=15)
            ax.text(end[0], end[1], end[2], lbl, color=col, fontsize=8,
                    fontweight="bold", zorder=20)

        # Dibujar base
        self._draw_base(ax, positions[0])

        # Ajustar límites
        r = self.robot.get_workspace_radius() * 0.7
        center = positions[-1]  # Centrar en TCP para mejor vista
        lim = r * 0.6
        ax.set_xlim3d(-lim, lim)
        ax.set_ylim3d(-lim, lim)
        ax.set_zlim3d(0, lim * 1.5)

        # Título con posición TCP
        T = transforms[-1]
        ax.set_title(
            f"TCP: X={T[0,3]:.1f}  Y={T[1,3]:.1f}  Z={T[2,3]:.1f} mm",
            color="#7ec8e3", fontsize=10, pad=10
        )

        # Restaurar posición de cámara (preserva zoom y rotación del usuario)
        ax.elev = elev
        ax.azim = azim
        if hasattr(ax, "dist"):
            ax.dist = dist

        self.canvas.draw_idle()

    def _draw_base(self, ax, base_pos):
        """Dibuja la base del robot."""
        bx, by, bz = base_pos
        size = 80
        ax.bar3d(bx - size/2, by - size/2, 0, size, size, bz if bz > 5 else 5,
                 color="#223344", alpha=0.7, zorder=1)
