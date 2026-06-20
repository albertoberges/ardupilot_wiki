"""
Panel de visión con IA integrado.
Muestra el feed de la cámara con detecciones de objetos superpuestas
y permite hacer pick & place con un clic.
"""

import threading
import time
import numpy as np
from typing import Optional, List

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QComboBox, QGroupBox, QListWidget, QListWidgetItem,
    QSplitter, QCheckBox, QMessageBox, QTextEdit,
    QFrame
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QImage, QPixmap, QFont, QColor

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

from vision.camera  import create_camera, list_available_cameras, BaseCamera, CameraFrame
from vision.detector import ObjectDetector, Detection
from vision.pose_estimator import PoseEstimator
from vision.calibration    import HandEyeCalibration
from gui.calibration_wizard import CalibrationWizard


# ================================================================== #
# Vista de cámara interactiva                                          #
# ================================================================== #

class CameraView(QLabel):
    """
    QLabel que muestra el feed de cámara y emite señales cuando
    el usuario hace clic sobre un objeto.
    """

    pixel_clicked = pyqtSignal(int, int)   # (x, y) imagen

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumSize(320, 240)
        self.setStyleSheet("""
            QLabel {
                background-color: #0a0f15;
                border: 2px solid #0f3460;
                border-radius: 4px;
                color: #3a5060;
            }
        """)
        self.setText("Sin señal de cámara\n\nInicia una cámara para comenzar")
        self.setFont(QFont("Segoe UI", 11))
        self.setCursor(Qt.CursorShape.CrossCursor)

        # Factores de escala para mapear clics → píxeles de imagen
        self._sx = 1.0;  self._sy = 1.0
        self._ox = 0;    self._oy = 0
        self._iw = 640;  self._ih = 480

    def set_image(self, bgr: np.ndarray):
        if not CV2_AVAILABLE or bgr is None:
            return
        h, w = bgr.shape[:2]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        qimg = QImage(rgb.data, w, h, rgb.strides[0], QImage.Format.Format_RGB888)
        pix  = QPixmap.fromImage(qimg)

        lw, lh = self.width(), self.height()
        scaled  = pix.scaled(lw, lh,
                              Qt.AspectRatioMode.KeepAspectRatio,
                              Qt.TransformationMode.SmoothTransformation)

        self._iw, self._ih = w, h
        self._sx = w / scaled.width()
        self._sy = h / scaled.height()
        self._ox = (lw - scaled.width())  // 2
        self._oy = (lh - scaled.height()) // 2
        self.setPixmap(scaled)

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            px = int((e.position().x() - self._ox) * self._sx)
            py = int((e.position().y() - self._oy) * self._sy)
            if 0 <= px < self._iw and 0 <= py < self._ih:
                self.pixel_clicked.emit(px, py)
        super().mousePressEvent(e)


# ================================================================== #
# Widget de un valor 3D                                               #
# ================================================================== #

class Coord3D(QWidget):
    """Muestra X, Y, Z con colores."""

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(8)
        self._vals = {}
        for name, color in [("X", "#ff6666"), ("Y", "#66ff88"), ("Z", "#6688ff")]:
            lbl = QLabel(f"{name}:")
            lbl.setStyleSheet(f"color: {color}; font-weight: bold;")
            val = QLabel("---")
            val.setStyleSheet("color: #00ff88; font-family: 'Courier New'; "
                              "font-size: 14px; font-weight: bold; min-width: 70px;")
            unit = QLabel("mm")
            unit.setStyleSheet("color: #506070;")
            lay.addWidget(lbl)
            lay.addWidget(val)
            lay.addWidget(unit)
            self._vals[name] = val

    def set(self, xyz: Optional[np.ndarray]):
        if xyz is None:
            for v in self._vals.values():
                v.setText("---")
        else:
            for name, val in self._vals.items():
                idx = {"X": 0, "Y": 1, "Z": 2}[name]
                val.setText(f"{xyz[idx]:+.1f}")


# ================================================================== #
# Panel principal de visión                                           #
# ================================================================== #

class VisionPanel(QWidget):
    """
    Panel de visión completo:
      • Feed de cámara con detecciones YOLO/color superpuestas
      • Clic en objeto → selección
      • Botón "COGER OBJETO" → mueve el robot al objeto seleccionado
      • Asistente de calibración mano-ojo
    """

    robot_moved  = pyqtSignal()
    log_message  = pyqtSignal(str)

    def __init__(self, robot, comm, parent=None):
        super().__init__(parent)
        self.robot = robot
        self.comm  = comm

        self._camera:        Optional[BaseCamera]    = None
        self._detector       = ObjectDetector(use_yolo=True)
        self._calibration    = HandEyeCalibration()
        self._pose_estimator: Optional[PoseEstimator] = None

        self._frame:       Optional[CameraFrame] = None
        self._detections:  List[Detection]       = []
        self._selected_idx = -1
        self._detect_on    = True
        self._running      = False

        self._calibration.load()
        self._setup_ui()
        self._init_detector_bg()

        # Timer de refresco de display a 25 Hz
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._refresh)
        self._timer.start(40)

    # ------------------------------------------------------------------ #
    # UI                                                                   #
    # ------------------------------------------------------------------ #

    def _setup_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(6, 6, 6, 6)
        root.setSpacing(6)

        # ---- Barra de cámara ---- #
        bar = QHBoxLayout()
        bar.setSpacing(6)

        bar.addWidget(QLabel("Fuente:"))
        self._src_combo = QComboBox()
        self._src_combo.setMinimumWidth(210)
        bar.addWidget(self._src_combo)

        ref_btn = QPushButton("↻")
        ref_btn.setFixedWidth(30)
        ref_btn.setToolTip("Refrescar fuentes de cámara")
        ref_btn.clicked.connect(self._refresh_sources)
        bar.addWidget(ref_btn)

        self._start_btn = QPushButton("▶  Iniciar cámara")
        self._start_btn.setCheckable(True)
        self._start_btn.setStyleSheet(self._btn_style("#004d20", "#007a33",
                                                       "#80ffb0", checked_bg="#600000",
                                                       checked_border="#aa0000",
                                                       checked_color="#ff8080"))
        self._start_btn.toggled.connect(self._toggle_camera)
        bar.addWidget(self._start_btn)

        bar.addWidget(QFrame(frameShape=QFrame.Shape.VLine,
                             styleSheet="color:#0f3460;"))

        self._det_check = QCheckBox("IA activa")
        self._det_check.setChecked(True)
        self._det_check.setStyleSheet("color: #7ec8e3;")
        self._det_check.toggled.connect(lambda v: setattr(self, "_detect_on", v))
        bar.addWidget(self._det_check)

        self._det_lbl = QLabel("Cargando detector...")
        self._det_lbl.setStyleSheet("color: #506070; font-size: 11px;")
        bar.addWidget(self._det_lbl)
        bar.addStretch()
        root.addLayout(bar)

        # ---- Cuerpo principal: cámara | panel derecho ---- #
        splitter = QSplitter(Qt.Orientation.Horizontal)

        self._cam_view = CameraView()
        self._cam_view.pixel_clicked.connect(self._on_pixel_click)
        splitter.addWidget(self._cam_view)

        right = self._build_right_panel()
        splitter.addWidget(right)
        splitter.setSizes([560, 230])
        root.addWidget(splitter, 1)

        # ---- Log ---- #
        self._log_box = QTextEdit()
        self._log_box.setReadOnly(True)
        self._log_box.setMaximumHeight(65)
        self._log_box.setStyleSheet(
            "QTextEdit { background:#0a0f15; border:1px solid #0f3460; "
            "font-family:'Courier New'; font-size:11px; color:#7090a0; }"
        )
        root.addWidget(self._log_box)

        self._refresh_sources()
        self._write_log("Panel de visión listo.")

    def _build_right_panel(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(4, 0, 0, 0)
        lay.setSpacing(8)

        # Objetos detectados
        det_box = QGroupBox("OBJETOS DETECTADOS")
        det_lay = QVBoxLayout(det_box)
        self._det_list = QListWidget()
        self._det_list.setStyleSheet(
            "QListWidget { background:#0a0f15; border:1px solid #0f3460; }"
            "QListWidget::item { padding:4px; border-bottom:1px solid #0d1520; }"
            "QListWidget::item:selected { background:#0078d4; }"
        )
        self._det_list.currentRowChanged.connect(self._on_list_select)
        det_lay.addWidget(self._det_list)
        hint = QLabel("Clic en la imagen o en la\nlista para seleccionar")
        hint.setStyleSheet("color:#3a5060; font-size:10px;")
        hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        det_lay.addWidget(hint)
        lay.addWidget(det_box)

        # Posición 3D estimada
        pos_box = QGroupBox("POSICIÓN 3D ESTIMADA")
        pos_lay = QVBoxLayout(pos_box)
        self._coord3d = Coord3D()
        pos_lay.addWidget(self._coord3d)
        lay.addWidget(pos_box)

        # Botón PICK
        self._pick_btn = QPushButton("🤖  COGER OBJETO")
        self._pick_btn.setEnabled(False)
        self._pick_btn.setStyleSheet("""
            QPushButton {
                background:#2a0060; color:#c080ff;
                border:2px solid #8040c0; border-radius:6px;
                font-size:14px; font-weight:bold;
                padding:12px; min-height:52px;
            }
            QPushButton:hover { background:#5000b0; }
            QPushButton:disabled {
                background:#130030; color:#503060;
                border-color:#280860;
            }
        """)
        self._pick_btn.clicked.connect(self._pick)
        lay.addWidget(self._pick_btn)

        # Calibración
        cal_box = QGroupBox("CALIBRACIÓN CÁMARA↔ROBOT")
        cal_lay = QVBoxLayout(cal_box)
        self._cal_lbl = QLabel(self._calibration.status_text())
        self._cal_lbl.setStyleSheet("color:#7090a0; font-size:11px;")
        self._cal_lbl.setWordWrap(True)
        cal_lay.addWidget(self._cal_lbl)
        cal_btn = QPushButton("⚙  Asistente de calibración")
        cal_btn.setStyleSheet(
            "QPushButton { background:#0d1520; color:#7ec8e3; "
            "border:1px solid #0f3460; padding:5px; border-radius:3px; }"
            "QPushButton:hover { background:#0f3460; }"
        )
        cal_btn.clicked.connect(self._open_calibration)
        cal_lay.addWidget(cal_btn)
        lay.addWidget(cal_box)

        lay.addStretch()
        return w

    # ------------------------------------------------------------------ #
    # Cámara                                                               #
    # ------------------------------------------------------------------ #

    def _refresh_sources(self):
        self._src_combo.clear()
        self._src_combo.addItems(list_available_cameras())

    def _toggle_camera(self, on: bool):
        if on:
            self._start_camera()
        else:
            self._stop_camera()

    def _start_camera(self):
        txt = self._src_combo.currentText()
        if txt.startswith("SIM"):
            src = "sim"
        elif txt.startswith("REALSENSE"):
            src = "realsense"
        else:
            idx = int(txt[3]) if txt[3:4].isdigit() else 0
            src = "webcam"

        self._camera = create_camera(src)
        if self._camera.start():
            self._camera.add_frame_callback(self._on_frame)
            self._pose_estimator = PoseEstimator(self._camera, self._calibration)
            self._running = True
            self._start_btn.setText("⏹  Detener cámara")
            self._write_log(f"Cámara iniciada: {txt}")
        else:
            self._running = False
            self._start_btn.setChecked(False)
            self._start_btn.setText("▶  Iniciar cámara")
            self._write_log("ERROR: no se pudo abrir la cámara")

    def _stop_camera(self):
        if self._camera:
            self._camera.stop()
        self._running = False
        self._frame = None
        self._start_btn.setText("▶  Iniciar cámara")
        self._write_log("Cámara detenida")

    def _on_frame(self, frame: CameraFrame):
        """Llamado desde el hilo de captura."""
        self._frame = frame

    # ------------------------------------------------------------------ #
    # Refresco de pantalla                                                 #
    # ------------------------------------------------------------------ #

    def _refresh(self):
        frame = self._frame
        if frame is None:
            return

        img = frame.color.copy()

        if self._detect_on and CV2_AVAILABLE:
            self._detections = self._detector.detect(img)
            img = self._detector.draw(img, self._detections, self._selected_idx)

        self._cam_view.set_image(img)
        self._sync_list()
        self._update_position(frame)

    def _sync_list(self):
        """Actualiza el listado de detecciones solo cuando cambia el contenido."""
        names_now = [d.class_name for d in self._detections]
        names_old = [self._det_list.item(i).data(Qt.ItemDataRole.UserRole)
                     for i in range(self._det_list.count())]
        if names_now == names_old:
            return

        self._det_list.blockSignals(True)
        self._det_list.clear()
        for det in self._detections:
            item = QListWidgetItem(
                f"{det.class_name}\n"
                f"  Confianza {det.confidence:.0%}  •  centro ({det.cx}, {det.cy})"
            )
            item.setData(Qt.ItemDataRole.UserRole, det.class_name)
            self._det_list.addItem(item)
        if 0 <= self._selected_idx < self._det_list.count():
            self._det_list.setCurrentRow(self._selected_idx)
        self._det_list.blockSignals(False)

    def _update_position(self, frame: CameraFrame):
        """Actualiza la posición 3D estimada del objeto seleccionado."""
        if not (0 <= self._selected_idx < len(self._detections)) \
                or self._pose_estimator is None:
            self._coord3d.set(None)
            self._pick_btn.setEnabled(False)
            return

        det = self._detections[self._selected_idx]
        pos = self._pose_estimator.estimate(det, frame.depth)
        self._coord3d.set(pos)
        self._pick_btn.setEnabled(pos is not None)

    # ------------------------------------------------------------------ #
    # Interacción                                                          #
    # ------------------------------------------------------------------ #

    def _on_pixel_click(self, x: int, y: int):
        """Selecciona el objeto sobre el que se hace clic en la imagen."""
        for i, det in enumerate(self._detections):
            if det.x1 <= x <= det.x2 and det.y1 <= y <= det.y2:
                self._selected_idx = i
                self._det_list.setCurrentRow(i)
                self._write_log(f"Seleccionado: {det.class_name}")
                return
        self._selected_idx = -1
        self._det_list.clearSelection()

    def _on_list_select(self, row: int):
        self._selected_idx = row

    def _pick(self):
        """Ejecuta el pick & place del objeto seleccionado."""
        if not (0 <= self._selected_idx < len(self._detections)):
            return
        if self._frame is None or self._pose_estimator is None:
            return

        det = self._detections[self._selected_idx]
        pos = self._pose_estimator.estimate(det, self._frame.depth)

        if pos is None:
            QMessageBox.warning(self, "Sin posición",
                                "No se pudo estimar la posición 3D del objeto.")
            return

        self._write_log(
            f"🤖 Pick & Place → {det.class_name}  "
            f"X={pos[0]:.1f}  Y={pos[1]:.1f}  Z={pos[2]:.1f} mm"
        )

        # Calcular IK
        q, ok = self.robot.inverse_kinematics(pos, q_init=self.robot.joint_angles)
        if ok:
            self.robot.set_joints(q)
            self.comm.send_joints(self.robot.joint_angles)
            self.robot_moved.emit()
            self._write_log(f"  ✓ Robot en movimiento")
        else:
            self._write_log("  ⚠ Posición fuera del espacio de trabajo")
            QMessageBox.warning(
                self, "Fuera de rango",
                f"'{det.class_name}' está fuera del espacio de trabajo.\n"
                f"Ajusta la posición de la cámara o el offset de calibración."
            )

    # ------------------------------------------------------------------ #
    # Calibración                                                          #
    # ------------------------------------------------------------------ #

    def _open_calibration(self):
        dlg = CalibrationWizard(
            self.robot, self._camera, self._calibration,
            frame_provider=lambda: self._frame,
            comm=self.comm,
            parent=self,
        )
        if dlg.exec() == QDialog.DialogCode.Accepted:
            if self._pose_estimator:
                self._pose_estimator.calibration = self._calibration
            self._cal_lbl.setText(self._calibration.status_text())
            self._write_log("✓ Calibración guardada")

    # ------------------------------------------------------------------ #
    # Detector (fondo)                                                     #
    # ------------------------------------------------------------------ #

    def _init_detector_bg(self):
        def _run():
            mode = self._detector.initialize()
            self._det_lbl.setText(self._detector.mode_label)
        threading.Thread(target=_run, daemon=True).start()

    # ------------------------------------------------------------------ #
    # Log                                                                  #
    # ------------------------------------------------------------------ #

    def _write_log(self, msg: str):
        ts = time.strftime("%H:%M:%S")
        self._log_box.append(
            f'<span style="color:#3a5060">[{ts}]</span> {msg}'
        )
        self._log_box.verticalScrollBar().setValue(
            self._log_box.verticalScrollBar().maximum()
        )
        self.log_message.emit(msg)

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _btn_style(bg, hover_bg, color, checked_bg="", checked_border="",
                   checked_color="") -> str:
        checked = ""
        if checked_bg:
            checked = (
                f"QPushButton:checked {{ background:{checked_bg}; "
                f"color:{checked_color}; border-color:{checked_border}; }}"
            )
        return (
            f"QPushButton {{ background:{bg}; color:{color}; "
            f"border:1px solid {hover_bg}; padding:5px 12px; "
            f"border-radius:4px; font-weight:bold; }}"
            f"QPushButton:hover {{ background:{hover_bg}; }}"
            + checked
        )

