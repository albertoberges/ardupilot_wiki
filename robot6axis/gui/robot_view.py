"""
Visualización 3D del robot con matplotlib embebido en PyQt6.
La vista (zoom, rotación) se preserva entre actualizaciones evitando ax.cla().
"""

import numpy as np
import matplotlib
matplotlib.use("QtAgg")

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 — necesario para projection="3d"
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QSizePolicy


class RobotView3D(QWidget):
    """Widget de visualización 3D del robot de 6 ejes."""

    LINK_COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#a8dadc", "#ffffff"]
    JOINT_COLOR = "#ffd700"
    TCP_COLORS  = ["#ff4444", "#44ff44", "#4444ff"]

    def __init__(self, robot, parent=None):
        super().__init__(parent)
        self.robot = robot
        self._data_artists = []   # artistas que se borran en cada update
        self._setup_ui()
        self.update_robot()

    # ------------------------------------------------------------------ #
    # Inicialización                                                        #
    # ------------------------------------------------------------------ #

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.figure = Figure(facecolor="#0d1117")
        self.canvas = FigureCanvasQTAgg(self.figure)
        self.canvas.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding
        )

        self.ax = self.figure.add_subplot(111, projection="3d")
        self._style_axes()
        self._init_static()

        layout.addWidget(self.canvas)
        self.setMinimumSize(400, 350)

    def _style_axes(self):
        """Estilos de los ejes — se llama una sola vez."""
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
        for spine in [ax.xaxis, ax.yaxis, ax.zaxis]:
            spine.line.set_color("#0f3460")

        ax.set_xlabel("X (mm)", fontsize=9, color="#7ec8e3")
        ax.set_ylabel("Y (mm)", fontsize=9, color="#7ec8e3")
        ax.set_zlabel("Z (mm)", fontsize=9, color="#7ec8e3")

    def _init_static(self):
        """Artistas fijos que no cambian (base, límites)."""
        r   = self.robot.get_workspace_radius() * 0.7
        lim = r * 0.6
        ax  = self.ax
        ax.set_xlim3d(-lim, lim)
        ax.set_ylim3d(-lim, lim)
        ax.set_zlim3d(0, lim * 1.5)

        # Base del robot — nunca se mueve
        size = 80
        ax.bar3d(-size / 2, -size / 2, 0, size, size, 5,
                 color="#223344", alpha=0.7, zorder=1)

    # ------------------------------------------------------------------ #
    # Actualización sin resetear la cámara                                 #
    # ------------------------------------------------------------------ #

    def update_robot(self, q_deg=None):
        """
        Redibuja solo las partes móviles del robot.
        No llama ax.cla(), por lo que el zoom y la rotación del usuario
        se mantienen intactos.
        """
        ax = self.ax

        # Borrar artistas de la pose anterior
        for art in self._data_artists:
            try:
                art.remove()
            except Exception:
                pass
        self._data_artists.clear()

        positions  = self.robot.get_link_positions(q_deg)   # (7, 3)
        transforms = self.robot.get_all_transforms(q_deg)

        # -- Eslabones --
        for i in range(len(positions) - 1):
            p0, p1 = positions[i], positions[i + 1]
            color = self.LINK_COLORS[i % len(self.LINK_COLORS)]
            ln, = ax.plot(
                [p0[0], p1[0]], [p0[1], p1[1]], [p0[2], p1[2]],
                color=color, linewidth=6, solid_capstyle="round", zorder=5
            )
            self._data_artists.append(ln)

        # -- Articulaciones (puntos) --
        for i, pos in enumerate(positions):
            ms = 10 if i == 0 else 7
            dot, = ax.plot(
                [pos[0]], [pos[1]], [pos[2]],
                "o", color=self.JOINT_COLOR,
                markersize=ms, zorder=10, markeredgewidth=0
            )
            self._data_artists.append(dot)

        # -- Sistema de referencia del TCP --
        tcp_T   = transforms[-1]
        tcp_pos = tcp_T[:3, 3]
        scale   = 60
        for j, (col, lbl) in enumerate(zip(self.TCP_COLORS, ["X", "Y", "Z"])):
            end  = tcp_pos + tcp_T[:3, j] * scale
            ln,  = ax.plot(
                [tcp_pos[0], end[0]], [tcp_pos[1], end[1]], [tcp_pos[2], end[2]],
                color=col, linewidth=2.5, zorder=15
            )
            txt  = ax.text(
                end[0], end[1], end[2], lbl,
                color=col, fontsize=8, fontweight="bold", zorder=20
            )
            self._data_artists += [ln, txt]

        # -- Título con posición TCP --
        T = transforms[-1]
        ax.set_title(
            f"TCP:  X={T[0,3]:.1f}   Y={T[1,3]:.1f}   Z={T[2,3]:.1f} mm",
            color="#7ec8e3", fontsize=10, pad=10
        )

        self.canvas.draw_idle()
