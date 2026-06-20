"""
Asistente visual de calibración cámara ↔ robot en 5 pasos.

Flujo:
  Paso 1 — Bienvenida y explicación
  Paso 2 — Colocación de la cámara (con vista previa en vivo)
  Paso 3 — Verificación del marcador de calibración
  Paso 4 — Recolección de puntos (jog + registro)
  Paso 5 — Resultado y guardado
"""

import numpy as np
from typing import Optional, Callable

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QWidget, QStackedWidget, QProgressBar, QGroupBox, QGridLayout,
    QListWidget, QListWidgetItem, QFrame, QSizePolicy, QMessageBox,
    QSlider
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont, QColor, QPainter, QPen, QBrush, QPixmap, QImage

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

from vision.calibration import HandEyeCalibration
from vision.pose_estimator import PoseEstimator
from vision.detector import ObjectDetector


# ================================================================== #
# Indicador de progreso visual                                         #
# ================================================================== #

class _StepIndicator(QWidget):
    """Burbujas numeradas unidas por línea, al estilo Material Design."""

    def __init__(self, n_steps: int, labels: list[str], parent=None):
        super().__init__(parent)
        self._n = n_steps
        self._labels = labels
        self._current = 0
        self.setFixedHeight(38)

    def set_step(self, step: int):
        self._current = step
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)

        w, h = self.width(), self.height()
        R = 10
        gap = max(40, (w - 60) // max(1, self._n - 1))
        total_w = (self._n - 1) * gap + 2 * R
        x0 = (w - total_w) // 2
        cy = 14

        # Connecting lines
        for i in range(self._n - 1):
            done = i < self._current
            p.setPen(QPen(QColor("#0078d4" if done else "#0f3460"), 2))
            p.drawLine(x0 + i * gap + R + 2, cy, x0 + (i + 1) * gap - R - 2, cy)

        # Step circles
        for i in range(self._n):
            cx = x0 + i * gap
            if i < self._current:
                # Completed
                p.setBrush(QBrush(QColor("#006633")))
                p.setPen(QPen(QColor("#00cc66"), 1))
                p.drawEllipse(cx, cy - R, 2 * R, 2 * R)
                p.setPen(QPen(QColor("#ffffff"), 2))
                p.drawLine(cx + R - 4, cy, cx + R - 1, cy + 3)
                p.drawLine(cx + R - 1, cy + 3, cx + R + 4, cy - 3)
            elif i == self._current:
                # Active
                p.setBrush(QBrush(QColor("#0055aa")))
                p.setPen(QPen(QColor("#40a0ff"), 2))
                p.drawEllipse(cx, cy - R, 2 * R, 2 * R)
                p.setPen(QPen(QColor("#ffffff"), 1))
                p.setFont(QFont("Arial", 8, QFont.Weight.Bold))
                p.drawText(cx, cy - R, 2 * R, 2 * R, Qt.AlignmentFlag.AlignCenter, str(i + 1))
            else:
                # Future
                p.setBrush(QBrush(QColor("#0a1020")))
                p.setPen(QPen(QColor("#0f3460"), 1))
                p.drawEllipse(cx, cy - R, 2 * R, 2 * R)
                p.setPen(QPen(QColor("#3a5060"), 1))
                p.setFont(QFont("Arial", 8))
                p.drawText(cx, cy - R, 2 * R, 2 * R, Qt.AlignmentFlag.AlignCenter, str(i + 1))

        # Step label below active
        if 0 <= self._current < len(self._labels):
            p.setPen(QPen(QColor("#7ec8e3")))
            p.setFont(QFont("Arial", 8))
            cx = x0 + self._current * gap
            p.drawText(cx - 30, cy + R + 2, 80, 14,
                       Qt.AlignmentFlag.AlignCenter, self._labels[self._current])


# ================================================================== #
# Botón de jog compacto                                                #
# ================================================================== #

class _MiniJogBtn(QPushButton):
    jog_active = pyqtSignal(bool)

    def __init__(self, text: str, parent=None):
        super().__init__(text, parent)
        self.setFixedSize(34, 28)
        self.setStyleSheet("""
            QPushButton {
                background:#0a1828; color:#7ec8e3;
                border:1px solid #1a3050; border-radius:3px;
                font-size:14px; font-weight:bold;
            }
            QPushButton:hover  { background:#0f3060; color:#ffffff; }
            QPushButton:pressed{ background:#0078d4; }
        """)

    def mousePressEvent(self, e):
        super().mousePressEvent(e)
        self.jog_active.emit(True)

    def mouseReleaseEvent(self, e):
        super().mouseReleaseEvent(e)
        self.jog_active.emit(False)


# ================================================================== #
# Vista de cámara compacta (reutilizable internamente)                 #
# ================================================================== #

class _MiniCamView(QLabel):
    def __init__(self, placeholder: str = "Sin señal de cámara", parent=None):
        super().__init__(placeholder, parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setStyleSheet(
            "background:#080d12; border:1px solid #0f3460; "
            "border-radius:4px; color:#2a4050; font-size:11px;"
        )
        self.setMinimumHeight(120)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    def set_bgr(self, bgr: np.ndarray):
        if not CV2_AVAILABLE or bgr is None:
            return
        try:
            h, w = bgr.shape[:2]
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            qi = QImage(rgb.data, w, h, rgb.strides[0], QImage.Format.Format_RGB888)
            pix = QPixmap.fromImage(qi)
            lw, lh = self.width(), self.height()
            if lw > 0 and lh > 0:
                self.setPixmap(pix.scaled(
                    lw, lh,
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation
                ))
        except Exception:
            pass


# ================================================================== #
# Asistente principal                                                  #
# ================================================================== #

class CalibrationWizard(QDialog):
    """
    Guía al usuario por 5 pasos para calibrar la posición de la cámara
    respecto al robot. Al final calcula la transformada 4×4 y permite
    guardarla en calibration.json.
    """

    N_STEPS = 5
    STEP_LABELS = ["Bienvenida", "Cámara", "Marcador", "Puntos", "Resultado"]
    TARGET_POINTS = 8

    def __init__(self, robot, camera, calibration: HandEyeCalibration,
                 frame_provider: Optional[Callable] = None,
                 comm=None,
                 parent=None):
        super().__init__(parent)
        self.robot = robot
        self.camera = camera
        self.calibration = calibration
        self.calibration.clear_points()
        self._frame_provider = frame_provider
        self._comm = comm

        self._detector = ObjectDetector(use_yolo=False)
        self._detector.initialize()
        self._pose_estimator: Optional[PoseEstimator] = None
        if camera and calibration:
            self._pose_estimator = PoseEstimator(camera, calibration)

        self._selected_cam_xyz: Optional[np.ndarray] = None
        self._jog_action: Optional[tuple] = None
        self._current_step = 0

        self.setWindowTitle("Asistente de Calibración — Cámara ↔ Robot")
        self.setMinimumSize(820, 640)
        self.setModal(True)
        if parent:
            self.setStyleSheet(parent.styleSheet())

        self._build_ui()
        self._go_to_step(0)

        self._refresh_timer = QTimer(self)
        self._refresh_timer.timeout.connect(self._tick)
        self._refresh_timer.start(80)

        self._jog_timer = QTimer(self)
        self._jog_timer.setInterval(50)
        self._jog_timer.timeout.connect(self._do_jog_step)

    # ------------------------------------------------------------------ #
    # Construcción de la UI                                                #
    # ------------------------------------------------------------------ #

    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # -- Header -- #
        header = QWidget()
        header.setFixedHeight(70)
        header.setStyleSheet("background:#060e18; border-bottom:1px solid #0f3460;")
        h_lay = QVBoxLayout(header)
        h_lay.setContentsMargins(20, 6, 20, 6)
        h_lay.setSpacing(4)

        title_lbl = QLabel("Asistente de Calibración  —  Cámara ↔ Robot")
        title_lbl.setStyleSheet("color:#7ec8e3; font-size:15px; font-weight:bold;")
        h_lay.addWidget(title_lbl)

        self._step_ind = _StepIndicator(self.N_STEPS, self.STEP_LABELS)
        h_lay.addWidget(self._step_ind)
        root.addWidget(header)

        # -- Step label bar -- #
        self._step_bar = QLabel()
        self._step_bar.setStyleSheet(
            "background:#0a1f30; color:#a0d0ff; font-size:12px; "
            "font-weight:bold; padding:5px 20px;"
        )
        root.addWidget(self._step_bar)

        # -- Content stack -- #
        self._stack = QStackedWidget()
        self._stack.addWidget(self._page_welcome())
        self._stack.addWidget(self._page_camera_placement())
        self._stack.addWidget(self._page_marker())
        self._stack.addWidget(self._page_collect())
        self._stack.addWidget(self._page_result())
        root.addWidget(self._stack, 1)

        # -- Navigation bar -- #
        nav = QWidget()
        nav.setFixedHeight(54)
        nav.setStyleSheet("background:#060e18; border-top:1px solid #0f3460;")
        n_lay = QHBoxLayout(nav)
        n_lay.setContentsMargins(20, 8, 20, 8)
        n_lay.setSpacing(8)

        self._back_btn = QPushButton("◀  Anterior")
        self._back_btn.setFixedWidth(120)
        self._back_btn.setStyleSheet(self._nav_btn_style(primary=False))
        self._back_btn.clicked.connect(self._go_back)
        n_lay.addWidget(self._back_btn)

        n_lay.addStretch()
        self._nav_hint = QLabel("")
        self._nav_hint.setStyleSheet("color:#506070; font-size:11px;")
        n_lay.addWidget(self._nav_hint)
        n_lay.addStretch()

        self._next_btn = QPushButton("Siguiente  ▶")
        self._next_btn.setFixedWidth(140)
        self._next_btn.setStyleSheet(self._nav_btn_style(primary=True))
        self._next_btn.clicked.connect(self._go_next)
        n_lay.addWidget(self._next_btn)
        root.addWidget(nav)

    # ------------------------------------------------------------------ #
    # Página 1 — Bienvenida                                               #
    # ------------------------------------------------------------------ #

    def _page_welcome(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(50, 24, 50, 16)
        lay.setSpacing(18)

        diagram = QLabel(
            "           📷  Cámara (fija, mirando abajo)\n"
            "            │\n"
            "            ▼\n"
            "  ┌─────────────────────────┐\n"
            "  │    ●  Marcador rojo      │\n"
            "  │                         │\n"
            "  │       Mesa de trabajo   │\n"
            "  └─────────────────────────┘\n"
            "              🦾  Robot 6 ejes"
        )
        diagram.setAlignment(Qt.AlignmentFlag.AlignCenter)
        diagram.setStyleSheet(
            "font-family:'Courier New'; font-size:12px; color:#3a7090; "
            "background:#060e18; border:1px solid #0f3460; "
            "border-radius:8px; padding:16px; line-height:1.5;"
        )
        lay.addWidget(diagram)

        info = QLabel(
            "<b style='color:#7ec8e3; font-size:14px;'>¿Para qué sirve esta calibración?</b><br><br>"
            "La cámara y el robot hablan con coordenadas distintas. "
            "Esta calibración calcula la <b>ecuación matemática</b> que transforma "
            "«lo que ve la cámara» en «dónde mover el robot».<br><br>"
            "<b>¿Qué necesitas?</b><br>"
            "&nbsp;&nbsp;• Un <b>objeto de color vivo</b> (rojo, azul, verde o amarillo)<br>"
            "&nbsp;&nbsp;• La cámara ya montada y <b>fija</b> sobre la mesa<br>"
            "&nbsp;&nbsp;• Unos <b>10 minutos</b><br><br>"
            "<b>¿Cómo funciona?</b><br>"
            "Pondrás el marcador en 8 posiciones diferentes de la mesa. "
            "En cada posición, moverás el robot hasta que su punta (TCP) "
            "toque el marcador y pulsarás «Registrar punto». "
            "La app apunta dónde estaba el robot y dónde vio la cámara el marcador, "
            "y al final calcula la transformada sola."
        )
        info.setWordWrap(True)
        info.setStyleSheet("color:#8090a0; font-size:12px; line-height:1.6;")
        lay.addWidget(info)
        lay.addStretch()
        return w

    # ------------------------------------------------------------------ #
    # Página 2 — Colocación de cámara                                     #
    # ------------------------------------------------------------------ #

    def _page_camera_placement(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(24, 16, 24, 12)
        lay.setSpacing(10)

        heading = QLabel("Cómo colocar la cámara")
        heading.setStyleSheet("color:#7ec8e3; font-size:14px; font-weight:bold;")
        lay.addWidget(heading)

        grid = QGridLayout()
        grid.setSpacing(8)
        tips = [
            ("📐", "Altura", "50–80 cm sobre la mesa. A más altura, mayor campo de visión."),
            ("🎯", "Ángulo", "Perpendicular a la mesa (mirando recto hacia abajo). Evita > 20°."),
            ("🔩", "Fijación", "Soporte rígido: trípode, abrazadera o brazo articulado fijo."),
            ("💡", "Luz", "Luz difusa frontal. Evita reflejos y sombras fuertes sobre los objetos."),
        ]
        for i, (icon, title, desc) in enumerate(tips):
            box = QGroupBox()
            box.setStyleSheet(
                "QGroupBox{background:#080f18;border:1px solid #0f3460;"
                "border-radius:5px;padding:6px;}"
            )
            b = QVBoxLayout(box)
            b.setSpacing(3)
            t = QLabel(f"{icon}  {title}")
            t.setStyleSheet("color:#7ec8e3; font-weight:bold; font-size:11px;")
            b.addWidget(t)
            d = QLabel(desc)
            d.setWordWrap(True)
            d.setStyleSheet("color:#8090a0; font-size:11px;")
            b.addWidget(d)
            grid.addWidget(box, i // 2, i % 2)
        lay.addLayout(grid)

        grp = QGroupBox("Vista previa en vivo")
        grp.setStyleSheet(
            "QGroupBox{color:#7ec8e3;font-weight:bold;font-size:11px;"
            "border:1px solid #0f3460;padding:4px;}"
        )
        g = QVBoxLayout(grp)
        self._cam_placement_view = _MiniCamView(
            "Inicia la cámara en el panel de Visión IA para ver la vista previa"
        )
        g.addWidget(self._cam_placement_view)
        lay.addWidget(grp, 1)
        return w

    # ------------------------------------------------------------------ #
    # Página 3 — Marcador                                                  #
    # ------------------------------------------------------------------ #

    def _page_marker(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(24, 16, 24, 12)
        lay.setSpacing(10)

        heading = QLabel("Prepara el marcador de calibración")
        heading.setStyleSheet("color:#7ec8e3; font-size:14px; font-weight:bold;")
        lay.addWidget(heading)

        desc = QLabel(
            "Necesitas un objeto pequeño de <b>color sólido brillante</b> que el robot "
            "pueda tocar con su punta (TCP) y que la cámara detecte automáticamente."
        )
        desc.setWordWrap(True)
        desc.setStyleSheet("color:#8090a0; font-size:12px;")
        lay.addWidget(desc)

        # Color swatches
        swatch_row = QHBoxLayout()
        for color, name, example in [
            ("#ee2222", "Rojo",     "bola de ping-pong\nroja o tapón rojo"),
            ("#2244ee", "Azul",     "bola azul o\ncinta adhesiva azul"),
            ("#22bb33", "Verde",    "tapón de botella\nverde"),
            ("#ddbb00", "Amarillo", "nota adhesiva\namarilla"),
        ]:
            col_w = QWidget()
            col_lay = QVBoxLayout(col_w)
            col_lay.setAlignment(Qt.AlignmentFlag.AlignCenter)
            col_lay.setSpacing(4)

            circle = QLabel()
            circle.setFixedSize(56, 56)
            circle.setStyleSheet(
                f"background:{color}; border-radius:28px; "
                f"border:3px solid #ffffff30;"
            )
            col_lay.addWidget(circle, alignment=Qt.AlignmentFlag.AlignCenter)

            n_lbl = QLabel(name)
            n_lbl.setStyleSheet("color:#e0e0e0; font-weight:bold; font-size:12px;")
            n_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            col_lay.addWidget(n_lbl)

            e_lbl = QLabel(example)
            e_lbl.setStyleSheet("color:#607080; font-size:10px;")
            e_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            col_lay.addWidget(e_lbl)

            swatch_row.addWidget(col_w)
        lay.addLayout(swatch_row)

        tip_lbl = QLabel(
            "💡  El marcador debe ser visible para la cámara y accesible para el robot. "
            "Tamaño ideal: 3–5 cm de diámetro."
        )
        tip_lbl.setWordWrap(True)
        tip_lbl.setStyleSheet(
            "color:#a08030; background:#1a1400; border:1px solid #3a2800; "
            "padding:8px; border-radius:4px; font-size:11px;"
        )
        lay.addWidget(tip_lbl)

        # Live detection status
        det_grp = QGroupBox("Estado del detector")
        det_grp.setStyleSheet(
            "QGroupBox{color:#7090a0;font-size:11px;"
            "border:1px solid #0f3460;padding:4px;}"
        )
        dg = QHBoxLayout(det_grp)
        self._marker_cam_view = _MiniCamView("Sin señal de cámara")
        self._marker_cam_view.setMaximumHeight(140)
        dg.addWidget(self._marker_cam_view, 2)

        self._marker_status = QLabel("Esperando imagen...")
        self._marker_status.setWordWrap(True)
        self._marker_status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._marker_status.setStyleSheet("color:#506070; font-size:11px; padding:6px;")
        dg.addWidget(self._marker_status, 1)
        lay.addWidget(det_grp)
        lay.addStretch()
        return w

    # ------------------------------------------------------------------ #
    # Página 4 — Recolección de puntos                                    #
    # ------------------------------------------------------------------ #

    def _page_collect(self) -> QWidget:
        w = QWidget()
        root = QHBoxLayout(w)
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(8)

        # -- Left: camera feed -- #
        left = QWidget()
        ll = QVBoxLayout(left)
        ll.setContentsMargins(0, 0, 0, 0)
        ll.setSpacing(6)

        cam_title = QLabel("Cámara — objeto detectado")
        cam_title.setStyleSheet("color:#506070; font-size:11px; font-weight:bold;")
        ll.addWidget(cam_title)

        self._collect_cam_view = _MiniCamView("Sin señal de cámara")
        ll.addWidget(self._collect_cam_view, 1)

        self._collect_obj_status = QLabel("Sin objeto detectado")
        self._collect_obj_status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._collect_obj_status.setStyleSheet(
            "color:#aa5500; background:#120a00; border:1px solid #2a1500; "
            "padding:5px; border-radius:3px; font-size:11px;"
        )
        ll.addWidget(self._collect_obj_status)

        cam_xyz_title = QLabel("Posición del objeto (coordenadas cámara):")
        cam_xyz_title.setStyleSheet("color:#405060; font-size:10px;")
        ll.addWidget(cam_xyz_title)

        self._collect_cam_xyz = QLabel("X: ---    Y: ---    Z: ---")
        self._collect_cam_xyz.setStyleSheet(
            "color:#4080a0; font-family:'Courier New'; font-size:11px; padding:2px;"
        )
        ll.addWidget(self._collect_cam_xyz)

        root.addWidget(left, 3)

        # -- Right: robot + jog + points -- #
        right = QWidget()
        rl = QVBoxLayout(right)
        rl.setContentsMargins(0, 0, 0, 0)
        rl.setSpacing(6)

        # TCP position
        tcp_grp = QGroupBox("Posición TCP del robot")
        tcp_grp.setStyleSheet(
            "QGroupBox{color:#7ec8e3;font-weight:bold;font-size:11px;"
            "border:1px solid #0f3460;padding:4px;}"
        )
        tg = QGridLayout(tcp_grp)
        tg.setSpacing(4)
        self._tcp_val = {}
        for r, (axis, color) in enumerate([("X", "#ff6666"), ("Y", "#66ee88"), ("Z", "#6688ff")]):
            tg.addWidget(self._colored_lbl(f"{axis}:", color, bold=True, size=12), r, 0)
            vl = QLabel("---")
            vl.setStyleSheet(
                "color:#00ff88; font-family:'Courier New'; "
                "font-size:14px; font-weight:bold; min-width:90px;"
            )
            tg.addWidget(vl, r, 1)
            tg.addWidget(self._colored_lbl("mm", "#3a5060", size=10), r, 2)
            self._tcp_val[axis] = vl
        rl.addWidget(tcp_grp)

        # Mini jog
        jog_grp = QGroupBox("Jog articular (mover robot)")
        jog_grp.setStyleSheet(
            "QGroupBox{color:#506070;font-size:11px;"
            "border:1px solid #0f3460;padding:4px;}"
        )
        jg = QGridLayout(jog_grp)
        jg.setSpacing(3)

        joints = [("J1","#e63946"),("J2","#f4a261"),("J3","#2a9d8f"),
                  ("J4","#457b9d"),("J5","#a8dadc"),("J6","#ccccff")]
        for i, (jname, jcolor) in enumerate(joints):
            lbl = QLabel(jname)
            lbl.setStyleSheet(f"color:{jcolor};font-weight:bold;font-size:11px;")
            lbl.setFixedWidth(22)
            jg.addWidget(lbl, i, 0)
            m = _MiniJogBtn("−")
            p = _MiniJogBtn("+")
            m.jog_active.connect(lambda active, idx=i: self._set_jog(idx, -1, active))
            p.jog_active.connect(lambda active, idx=i: self._set_jog(idx, +1, active))
            jg.addWidget(m, i, 1)
            jg.addWidget(p, i, 2)

        rl.addWidget(jog_grp)

        # Speed
        sp_row = QHBoxLayout()
        sp_row.addWidget(self._colored_lbl("Vel:", "#405060", size=10))
        self._jog_speed = QSlider(Qt.Orientation.Horizontal)
        self._jog_speed.setRange(1, 100)
        self._jog_speed.setValue(15)
        self._jog_speed.setFixedWidth(80)
        sp_row.addWidget(self._jog_speed)
        self._jog_speed_lbl = QLabel("15%")
        self._jog_speed_lbl.setStyleSheet("color:#405060; font-size:10px; min-width:28px;")
        self._jog_speed.valueChanged.connect(
            lambda v: self._jog_speed_lbl.setText(f"{v}%")
        )
        sp_row.addWidget(self._jog_speed_lbl)
        sp_row.addStretch()
        rl.addLayout(sp_row)

        # Progress + points list
        prog_grp = QGroupBox(f"Puntos registrados  (mínimo {HandEyeCalibration.MIN_POINTS},"
                             f" recomendado {self.TARGET_POINTS})")
        prog_grp.setStyleSheet(
            "QGroupBox{color:#506070;font-size:10px;"
            "border:1px solid #0f3460;padding:4px;}"
        )
        pg = QVBoxLayout(prog_grp)
        pg.setSpacing(4)

        self._collect_bar = QProgressBar()
        self._collect_bar.setRange(0, self.TARGET_POINTS)
        self._collect_bar.setValue(0)
        self._collect_bar.setFormat("%v / %m puntos")
        self._collect_bar.setTextVisible(True)
        self._collect_bar.setStyleSheet("""
            QProgressBar {
                background:#060e18; border:1px solid #0f3460;
                border-radius:3px; height:16px;
                color:#7ec8e3; text-align:center; font-size:10px;
            }
            QProgressBar::chunk { background:#004d99; border-radius:2px; }
        """)
        pg.addWidget(self._collect_bar)

        self._collect_pts_list = QListWidget()
        self._collect_pts_list.setMaximumHeight(90)
        self._collect_pts_list.setStyleSheet(
            "QListWidget{background:#060e18;border:1px solid #0f3460;font-size:10px;}"
            "QListWidget::item{padding:2px;border-bottom:1px solid #0a1520;}"
        )
        pg.addWidget(self._collect_pts_list)

        btn_row = QHBoxLayout()
        self._register_btn = QPushButton("📍  Registrar punto")
        self._register_btn.setStyleSheet("""
            QPushButton {
                background:#003d18; color:#60ffa0;
                border:1px solid #006633; padding:5px 8px;
                border-radius:4px; font-weight:bold; font-size:12px;
            }
            QPushButton:hover { background:#006633; }
            QPushButton:disabled {
                background:#080f0a; color:#204030;
                border-color:#0a2018;
            }
        """)
        self._register_btn.clicked.connect(self._register_point)
        btn_row.addWidget(self._register_btn)

        undo_btn = QPushButton("↩")
        undo_btn.setFixedWidth(30)
        undo_btn.setToolTip("Deshacer último punto")
        undo_btn.setStyleSheet(
            "QPushButton{background:#120808;color:#aa4444;"
            "border:1px solid #2a1010;border-radius:4px;padding:5px;}"
            "QPushButton:hover{background:#2a1010;}"
        )
        undo_btn.clicked.connect(self._undo_point)
        btn_row.addWidget(undo_btn)
        pg.addLayout(btn_row)
        rl.addWidget(prog_grp)

        rl.addStretch()
        root.addWidget(right, 2)
        return w

    # ------------------------------------------------------------------ #
    # Página 5 — Resultado                                                 #
    # ------------------------------------------------------------------ #

    def _page_result(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(50, 20, 50, 16)
        lay.setSpacing(14)

        self._result_icon_lbl = QLabel("⏳")
        self._result_icon_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._result_icon_lbl.setStyleSheet("font-size:48px;")
        lay.addWidget(self._result_icon_lbl)

        self._result_title_lbl = QLabel("Calculando...")
        self._result_title_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._result_title_lbl.setStyleSheet(
            "font-size:20px; font-weight:bold; color:#7ec8e3;"
        )
        lay.addWidget(self._result_title_lbl)

        self._result_error_lbl = QLabel("")
        self._result_error_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._result_error_lbl.setStyleSheet("font-size:13px; color:#8090a0;")
        lay.addWidget(self._result_error_lbl)

        # Quality bar
        self._quality_bar = QProgressBar()
        self._quality_bar.setRange(0, 100)
        self._quality_bar.setValue(0)
        self._quality_bar.setTextVisible(False)
        self._quality_bar.setFixedHeight(14)
        self._quality_bar.setStyleSheet("""
            QProgressBar { background:#060e18; border:1px solid #0f3460; border-radius:6px; }
            QProgressBar::chunk { background:#00aa55; border-radius:5px; }
        """)
        lay.addWidget(self._quality_bar)

        quality_labels = QHBoxLayout()
        quality_labels.addWidget(self._colored_lbl("Excelente (<5 mm)", "#00aa55", size=10))
        quality_labels.addStretch()
        quality_labels.addWidget(self._colored_lbl("Bueno (<15 mm)", "#aaaa00", size=10))
        quality_labels.addStretch()
        quality_labels.addWidget(self._colored_lbl("Mejorable (>15 mm)", "#aa4400", size=10))
        lay.addLayout(quality_labels)

        # Matrix
        mat_grp = QGroupBox("Transformada calculada  T_cam→robot  (4×4)")
        mat_grp.setStyleSheet(
            "QGroupBox{color:#405060;font-size:11px;"
            "border:1px solid #0a2030;padding:4px;}"
        )
        mg = QVBoxLayout(mat_grp)
        self._matrix_lbl = QLabel("—")
        self._matrix_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._matrix_lbl.setStyleSheet(
            "font-family:'Courier New'; font-size:11px; color:#3a7060; padding:4px;"
        )
        mg.addWidget(self._matrix_lbl)
        lay.addWidget(mat_grp)

        self._result_hint = QLabel("")
        self._result_hint.setWordWrap(True)
        self._result_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._result_hint.setStyleSheet("color:#607080; font-size:11px;")
        lay.addWidget(self._result_hint)

        action_row = QHBoxLayout()
        self._save_btn = QPushButton("💾  Guardar calibración")
        self._save_btn.setEnabled(False)
        self._save_btn.setStyleSheet("""
            QPushButton {
                background:#003060; color:#80c0ff;
                border:1px solid #0055aa; padding:8px 22px;
                border-radius:5px; font-size:13px; font-weight:bold;
            }
            QPushButton:hover  { background:#005599; }
            QPushButton:disabled { background:#080f18; color:#2a4050; border-color:#0a1f30; }
        """)
        self._save_btn.clicked.connect(self._save_and_accept)
        action_row.addWidget(self._save_btn)

        retry_btn = QPushButton("↺  Añadir más puntos")
        retry_btn.setStyleSheet(
            "QPushButton{background:#0a1520;color:#506070;"
            "border:1px solid #0f3460;padding:8px 14px;border-radius:5px;}"
            "QPushButton:hover{background:#0f3060;color:#7090a0;}"
        )
        retry_btn.clicked.connect(lambda: self._go_to_step(3))
        action_row.addWidget(retry_btn)
        lay.addLayout(action_row)
        lay.addStretch()
        return w

    # ------------------------------------------------------------------ #
    # Navegación                                                           #
    # ------------------------------------------------------------------ #

    def _go_to_step(self, step: int):
        self._current_step = step
        self._stack.setCurrentIndex(step)
        self._step_ind.set_step(step)
        self._step_bar.setText(
            f"  Paso {step + 1} de {self.N_STEPS}  —  {self.STEP_LABELS[step]}"
        )

        self._back_btn.setEnabled(step > 0)
        is_last = (step == self.N_STEPS - 1)
        is_collect = (step == self.N_STEPS - 2)

        if is_last:
            self._next_btn.setText("✓  Cerrar")
            self._next_btn.setEnabled(True)
            self._compute_calibration()
        elif is_collect:
            self._next_btn.setText("Calcular  ▶")
            n = self.calibration.num_points
            self._next_btn.setEnabled(n >= HandEyeCalibration.MIN_POINTS)
        else:
            self._next_btn.setText("Siguiente  ▶")
            self._next_btn.setEnabled(True)

        n = self.calibration.num_points
        self._nav_hint.setText(
            f"{n} punto{'s' if n != 1 else ''} registrado{'s' if n != 1 else ''}"
            if n > 0 else ""
        )

    def _go_next(self):
        if self._current_step == self.N_STEPS - 1:
            self.accept()
            return
        self._go_to_step(self._current_step + 1)

    def _go_back(self):
        if self._current_step > 0:
            self._go_to_step(self._current_step - 1)

    # ------------------------------------------------------------------ #
    # Jog                                                                  #
    # ------------------------------------------------------------------ #

    def _set_jog(self, joint_idx: int, direction: int, active: bool):
        if active:
            self._jog_action = (joint_idx, direction)
            self._jog_timer.start()
        else:
            self._jog_action = None
            self._jog_timer.stop()

    def _do_jog_step(self):
        if not self._jog_action:
            self._jog_timer.stop()
            return
        idx, direction = self._jog_action
        speed = self._jog_speed.value() / 100.0
        self.robot.jog_joint(idx, 1.0 * speed * direction)
        if self._comm:
            self._comm.send_joints(self.robot.joint_angles)

    # ------------------------------------------------------------------ #
    # Registro de puntos                                                   #
    # ------------------------------------------------------------------ #

    def _register_point(self):
        T = self.robot.forward_kinematics()
        robot_xyz = T[:3, 3].copy()

        cam_xyz = self._selected_cam_xyz
        if cam_xyz is None:
            QMessageBox.warning(
                self, "Sin objeto detectado",
                "No hay ningún objeto detectado en la imagen de cámara.\n\n"
                "Asegúrate de que el marcador de color sea visible y que "
                "el detector esté activo."
            )
            return

        self.calibration.add_point(robot_xyz, cam_xyz)
        n = self.calibration.num_points

        item = QListWidgetItem(
            f"P{n:02d}  Robot [{robot_xyz[0]:+.0f}, {robot_xyz[1]:+.0f},"
            f" {robot_xyz[2]:+.0f}]  Cam [{cam_xyz[0]:+.0f},"
            f" {cam_xyz[1]:+.0f}, {cam_xyz[2]:+.0f}] mm"
        )
        self._collect_pts_list.addItem(item)
        self._collect_pts_list.scrollToBottom()
        self._collect_bar.setValue(min(n, self.TARGET_POINTS))

        self._next_btn.setEnabled(n >= HandEyeCalibration.MIN_POINTS)
        self._nav_hint.setText(
            f"{n} punto{'s' if n != 1 else ''} registrado{'s' if n != 1 else ''}"
        )

    def _undo_point(self):
        self.calibration.remove_last_point()
        c = self._collect_pts_list.count()
        if c > 0:
            self._collect_pts_list.takeItem(c - 1)
        n = self.calibration.num_points
        self._collect_bar.setValue(min(n, self.TARGET_POINTS))
        self._next_btn.setEnabled(n >= HandEyeCalibration.MIN_POINTS)
        self._nav_hint.setText(
            f"{n} punto{'s' if n != 1 else ''} registrado{'s' if n != 1 else ''}"
            if n > 0 else ""
        )

    # ------------------------------------------------------------------ #
    # Cálculo de calibración                                              #
    # ------------------------------------------------------------------ #

    def _compute_calibration(self):
        ok, msg = self.calibration.compute()
        if ok:
            err = self.calibration.error_mm
            if err < 5:
                icon, title, color = "✅", "Excelente", "#00dd66"
                hint = "La calibración es muy precisa. El robot encontrará los objetos con gran exactitud."
                quality_pct = 100
                chunk_color = "#00aa55"
            elif err < 15:
                icon, title, color = "✔", "Buena", "#ddbb00"
                hint = f"Error de {err:.1f} mm — aceptable para Pick & Place. Para mayor precisión añade más puntos."
                quality_pct = max(10, int(100 - (err - 5) * 5))
                chunk_color = "#aaaa00"
            else:
                icon, title, color = "⚠", "Mejorable", "#ff7733"
                hint = (f"Error de {err:.1f} mm — añade más puntos bien dispersos por la mesa "
                        f"para reducirlo.")
                quality_pct = max(5, int(50 - err))
                chunk_color = "#aa4400"

            self._result_icon_lbl.setText(icon)
            self._result_title_lbl.setText(f"{title}  —  error medio: {err:.1f} mm")
            self._result_title_lbl.setStyleSheet(
                f"font-size:20px; font-weight:bold; color:{color};"
            )
            self._result_error_lbl.setText(
                f"Puntos usados: {self.calibration.num_points}"
            )
            self._quality_bar.setValue(quality_pct)
            self._quality_bar.setStyleSheet(
                f"QProgressBar{{background:#060e18;border:1px solid #0f3460;"
                f"border-radius:6px;}}"
                f"QProgressBar::chunk{{background:{chunk_color};border-radius:5px;}}"
            )
            self._result_hint.setText(hint)

            T = self.calibration._T
            if T is not None:
                rows = ["  ".join(f"{v:+7.3f}" for v in row) for row in T]
                self._matrix_lbl.setText("\n".join(rows))
                self._matrix_lbl.setStyleSheet(
                    f"font-family:'Courier New'; font-size:11px; color:{color}80; padding:4px;"
                )

            self._save_btn.setEnabled(True)
        else:
            self._result_icon_lbl.setText("✗")
            self._result_title_lbl.setText("Error en la calibración")
            self._result_title_lbl.setStyleSheet(
                "font-size:20px; font-weight:bold; color:#ff4444;"
            )
            self._result_error_lbl.setText(msg)
            self._result_hint.setText(
                "Necesitas al menos 4 puntos para calcular la transformada. "
                "Vuelve al paso anterior y registra más puntos."
            )
            self._save_btn.setEnabled(False)

    def _save_and_accept(self):
        self.calibration.save()
        self.accept()

    # ------------------------------------------------------------------ #
    # Timer — refresco de cámara y posición de robot                      #
    # ------------------------------------------------------------------ #

    def _tick(self):
        # Robot TCP position (siempre)
        try:
            T = self.robot.forward_kinematics()
            xyz = T[:3, 3]
            for axis, lbl in self._tcp_val.items():
                lbl.setText(f"{xyz[{'X':0,'Y':1,'Z':2}[axis]]:+.1f}")
        except Exception:
            pass

        # Camera frame
        frame = None
        if self._frame_provider:
            try:
                frame = self._frame_provider()
            except Exception:
                pass

        if frame is None or not CV2_AVAILABLE:
            return

        img = frame.color.copy()
        detections = self._detector.detect(img)
        annotated = self._detector.draw(img, detections, 0 if detections else -1)

        step = self._current_step

        if step == 1:
            self._cam_placement_view.set_bgr(annotated)

        elif step == 2:
            self._marker_cam_view.set_bgr(annotated)
            if detections:
                d = detections[0]
                self._marker_status.setText(
                    f"✓ Detectado: {d.class_name}  ({d.confidence:.0%})\n"
                    f"¡Listo para pasar a recoger puntos!"
                )
                self._marker_status.setStyleSheet(
                    "color:#00dd66; background:#001a0a; "
                    "border:1px solid #006633; padding:6px; "
                    "border-radius:3px; font-size:11px; font-weight:bold;"
                )
            else:
                self._marker_status.setText(
                    "Sin objeto detectado\n"
                    "Coloca el marcador de color dentro del campo de visión"
                )
                self._marker_status.setStyleSheet(
                    "color:#aa5500; background:#120800; "
                    "border:1px solid #2a1500; padding:6px; "
                    "border-radius:3px; font-size:11px;"
                )

        elif step == 3:
            self._collect_cam_view.set_bgr(annotated)
            self._selected_cam_xyz = None

            if detections and self._pose_estimator:
                det = detections[0]
                pos = self._pose_estimator.estimate(det, frame.depth)
                if pos is not None:
                    self._selected_cam_xyz = pos
                    self._collect_cam_xyz.setText(
                        f"X: {pos[0]:+.1f}    Y: {pos[1]:+.1f}    Z: {pos[2]:+.1f}"
                    )
                    self._collect_obj_status.setText(
                        f"✓  {det.class_name}  detectado — "
                        f"mueve el robot hasta tocar el objeto y pulsa «Registrar»"
                    )
                    self._collect_obj_status.setStyleSheet(
                        "color:#00dd66; background:#001a0a; border:1px solid #006633; "
                        "padding:5px; border-radius:3px; font-size:11px;"
                    )
                else:
                    self._collect_obj_status.setText(
                        "Objeto visto pero sin posición 3D — comprueba la cámara"
                    )
                    self._collect_obj_status.setStyleSheet(
                        "color:#aa7700; background:#120d00; border:1px solid #2a1a00; "
                        "padding:5px; border-radius:3px; font-size:11px;"
                    )
            else:
                self._collect_cam_xyz.setText("X: ---    Y: ---    Z: ---")
                self._collect_obj_status.setText(
                    "Sin objeto detectado — acerca el marcador al campo de visión"
                )
                self._collect_obj_status.setStyleSheet(
                    "color:#aa4400; background:#120800; border:1px solid #2a1000; "
                    "padding:5px; border-radius:3px; font-size:11px;"
                )

    # ------------------------------------------------------------------ #
    # Cierre                                                               #
    # ------------------------------------------------------------------ #

    def closeEvent(self, e):
        self._refresh_timer.stop()
        self._jog_timer.stop()
        super().closeEvent(e)

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _colored_lbl(text: str, color: str, bold: bool = False, size: int = 11) -> QLabel:
        lbl = QLabel(text)
        weight = "bold;" if bold else ""
        lbl.setStyleSheet(f"color:{color}; font-size:{size}px; {weight}")
        return lbl

    @staticmethod
    def _nav_btn_style(primary: bool) -> str:
        if primary:
            return (
                "QPushButton{"
                "background:#004499;color:#ffffff;"
                "border:1px solid #3388ff;padding:6px 14px;"
                "border-radius:4px;font-weight:bold;}"
                "QPushButton:hover{background:#3388ff;}"
                "QPushButton:disabled{"
                "background:#0a1520;color:#2a4050;border-color:#0a1f30;}"
            )
        return (
            "QPushButton{"
            "background:#0a1520;color:#506070;"
            "border:1px solid #0f3460;padding:6px 14px;"
            "border-radius:4px;}"
            "QPushButton:enabled{color:#7090a0;}"
            "QPushButton:hover:enabled{background:#0f3060;}"
            "QPushButton:disabled{color:#2a3040;}"
        )
