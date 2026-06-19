"""
Capa de abstracción de cámara.
Soporta: webcam USB (OpenCV), Intel RealSense D435i y cámara simulada por software.
"""

import threading
import time
import math
import numpy as np
from typing import Optional, List, Callable
from dataclasses import dataclass, field

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import pyrealsense2 as rs
    REALSENSE_AVAILABLE = True
except ImportError:
    REALSENSE_AVAILABLE = False


# ================================================================== #
# Frame                                                                #
# ================================================================== #

@dataclass
class CameraFrame:
    """Frame capturado por la cámara."""
    color: np.ndarray                     # Imagen BGR (H, W, 3)
    depth: Optional[np.ndarray] = None   # Profundidad en mm (H, W). None si no disponible.
    timestamp: float = field(default_factory=time.time)

    @property
    def height(self) -> int: return self.color.shape[0]
    @property
    def width(self) -> int:  return self.color.shape[1]


# ================================================================== #
# Clase base                                                           #
# ================================================================== #

class BaseCamera:
    """Interfaz abstracta para todos los tipos de cámara."""

    WIDTH  = 640
    HEIGHT = 480

    # Parámetros intrínsecos por defecto (cámara genérica 640×480, FOV ~60°)
    # Calibra estos valores con cv2.calibrateCamera() para mayor precisión.
    FX: float = 600.0   # Distancia focal X (píxeles)
    FY: float = 600.0   # Distancia focal Y (píxeles)
    CX: float = 320.0   # Punto principal X
    CY: float = 240.0   # Punto principal Y

    def __init__(self):
        self._running = False
        self._frame: Optional[CameraFrame] = None
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._callbacks: List[Callable] = []

    # ---- Ciclo de vida ---- #

    def start(self) -> bool:
        """Inicia la captura. Devuelve True si tiene éxito."""
        raise NotImplementedError

    def stop(self):
        """Para la captura y espera a que el hilo termine."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)

    # ---- Acceso a frames ---- #

    def get_frame(self) -> Optional[CameraFrame]:
        """Obtiene el último frame (thread-safe). None si aún no hay frame."""
        with self._lock:
            return self._frame

    def add_frame_callback(self, cb: Callable):
        """Registra una función que se llama con cada nuevo frame."""
        self._callbacks.append(cb)

    def _publish(self, frame: CameraFrame):
        with self._lock:
            self._frame = frame
        for cb in self._callbacks:
            try:
                cb(frame)
            except Exception:
                pass

    # ---- Geometría ---- #

    @property
    def has_depth(self) -> bool:
        """True si esta cámara proporciona datos de profundidad."""
        return False

    def pixel_to_3d(self, u: float, v: float, depth_mm: float) -> np.ndarray:
        """
        Retroproyecta el píxel (u, v) con profundidad depth_mm a coordenadas
        3D en el sistema de la cámara (mm).  Devuelve [X, Y, Z].
        """
        x = (u - self.CX) * depth_mm / self.FX
        y = (v - self.CY) * depth_mm / self.FY
        return np.array([x, y, depth_mm])


# ================================================================== #
# Webcam USB (OpenCV)                                                  #
# ================================================================== #

class WebcamCamera(BaseCamera):
    """Cámara USB estándar a través de OpenCV."""

    def __init__(self, index: int = 0):
        super().__init__()
        self.index = index
        self._cap = None

    def start(self) -> bool:
        if not CV2_AVAILABLE:
            return False
        self._cap = cv2.VideoCapture(self.index)
        if not self._cap.isOpened():
            return False
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self.WIDTH)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.HEIGHT)
        self._cap.set(cv2.CAP_PROP_FPS, 30)
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        super().stop()
        if self._cap:
            self._cap.release()

    def _loop(self):
        while self._running:
            ret, img = self._cap.read()
            if ret:
                self._publish(CameraFrame(color=img))
            time.sleep(1 / 30)


# ================================================================== #
# Intel RealSense D435i                                                #
# ================================================================== #

class RealSenseCamera(BaseCamera):
    """
    Intel RealSense D435i — proporciona color RGB + profundidad alineada.
    Requiere: pip install pyrealsense2
    """

    # Intrínsecos típicos del D435i a 640×480
    FX = 615.0
    FY = 615.0
    CX = 320.0
    CY = 240.0

    def __init__(self):
        super().__init__()
        self._pipeline = None

    @property
    def has_depth(self) -> bool:
        return True

    def start(self) -> bool:
        if not REALSENSE_AVAILABLE:
            return False
        try:
            self._pipeline = rs.pipeline()
            cfg = rs.config()
            cfg.enable_stream(rs.stream.color, self.WIDTH, self.HEIGHT, rs.format.bgr8, 30)
            cfg.enable_stream(rs.stream.depth, self.WIDTH, self.HEIGHT, rs.format.z16, 30)
            self._pipeline.start(cfg)
            self._running = True
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            return True
        except Exception:
            return False

    def stop(self):
        super().stop()
        if self._pipeline:
            try:
                self._pipeline.stop()
            except Exception:
                pass

    def _loop(self):
        align = rs.align(rs.stream.color)
        while self._running:
            try:
                frames   = self._pipeline.wait_for_frames(timeout_ms=1000)
                aligned  = align.process(frames)
                c_frame  = aligned.get_color_frame()
                d_frame  = aligned.get_depth_frame()
                if c_frame and d_frame:
                    color = np.asanyarray(c_frame.get_data())
                    depth = np.asanyarray(d_frame.get_data()).astype(np.float32)
                    # Convertir unidades RealSense (unidades de escala) a mm
                    depth *= d_frame.get_units() * 1000
                    self._publish(CameraFrame(color=color, depth=depth))
            except Exception:
                time.sleep(0.033)


# ================================================================== #
# Cámara simulada por software                                         #
# ================================================================== #

class SimulatedCamera(BaseCamera):
    """
    Cámara totalmente simulada para pruebas sin hardware.
    Renderiza objetos de colores sobre una mesa virtual con profundidad sintética.
    """

    # Objetos simulados: (nombre, BGR, x_mm, y_mm, forma)
    OBJECTS = [
        ("caja_roja",      (20,  20, 210), 140,   70, "rect"),
        ("caja_azul",      (210, 60,  20), -90,  110, "rect"),
        ("botella_verde",  (30, 190,  30), 190,  -90, "circle"),
        ("pieza_amarilla", (20, 210, 210), -60, -110, "rect"),
    ]

    TABLE_DEPTH_MM  = 600.0   # Distancia cámara → mesa (mm)
    OBJECT_LIFT_MM  = 50.0    # Altura de los objetos sobre la mesa (mm)

    def __init__(self):
        super().__init__()
        self._t = 0.0

    @property
    def has_depth(self) -> bool:
        return True

    def start(self) -> bool:
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return True

    def _loop(self):
        while self._running:
            self._publish(self._render())
            self._t += 0.025
            time.sleep(1 / 25)

    def _render(self) -> CameraFrame:
        if not CV2_AVAILABLE:
            # Sin cv2: devuelve imagen sintética simple (degradado)
            color = np.zeros((self.HEIGHT, self.WIDTH, 3), dtype=np.uint8)
            depth = np.full((self.HEIGHT, self.WIDTH), self.TABLE_DEPTH_MM, dtype=np.float32)
            return CameraFrame(color=color, depth=depth)

        # Fondo — mesa oscura con cuadrícula
        color = np.full((self.HEIGHT, self.WIDTH, 3), (50, 65, 75), dtype=np.uint8)
        for x in range(0, self.WIDTH,  40):
            cv2.line(color, (x, 0), (x, self.HEIGHT), (58, 73, 83), 1)
        for y in range(0, self.HEIGHT, 40):
            cv2.line(color, (0, y), (self.WIDTH,  y), (58, 73, 83), 1)

        # Profundidad: mesa a TABLE_DEPTH_MM
        depth = np.full((self.HEIGHT, self.WIDTH), self.TABLE_DEPTH_MM, dtype=np.float32)
        z_obj = self.TABLE_DEPTH_MM - self.OBJECT_LIFT_MM

        for i, (name, bgr, x0, y0, shape) in enumerate(self.OBJECTS):
            # Pequeña animación senoidal
            ph  = self._t + i * 1.3
            xmm = x0 + math.sin(ph * 0.28) * 6
            ymm = y0 + math.cos(ph * 0.22) * 6

            # Proyección al plano imagen (cámara mirando hacia abajo)
            u = int(self.CX + xmm * self.FX / z_obj)
            v = int(self.CY + ymm * self.FY / z_obj)

            bright = tuple(min(255, c + 70) for c in bgr)

            if shape == "rect":
                w, h = 42, 32
                x1, y1 = u - w//2, v - h//2
                x2, y2 = u + w//2, v + h//2
                cv2.rectangle(color, (x1+3, y1+3), (x2+3, y2+3), (20, 30, 38), -1)  # sombra
                cv2.rectangle(color, (x1, y1), (x2, y2), bgr, -1)
                cv2.rectangle(color, (x1, y1), (x2, y2), bright, 2)
                r1 = np.s_[max(0,y1):min(self.HEIGHT,y2), max(0,x1):min(self.WIDTH,x2)]
                depth[r1] = z_obj
            else:
                r = 23
                cv2.circle(color, (u+3, v+3), r, (20, 30, 38), -1)
                cv2.circle(color, (u, v), r, bgr, -1)
                cv2.circle(color, (u, v), r, bright, 2)
                cv2.circle(depth, (u, v), r, z_obj, -1)  # type: ignore

            tag = name.split("_")[0]
            cv2.putText(color, tag, (u - 22, v - 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1)

        # Marca de agua
        cv2.putText(color, "SIMULACION", (8, 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (90, 90, 90), 1)

        return CameraFrame(color=color, depth=depth)

    def get_true_positions_3d(self) -> dict:
        """Devuelve las posiciones 3D reales de los objetos (para verificación)."""
        z = self.TABLE_DEPTH_MM - self.OBJECT_LIFT_MM
        return {name: np.array([x, y, z]) for name, _, x, y, _ in self.OBJECTS}


# ================================================================== #
# Utilidades                                                           #
# ================================================================== #

def create_camera(source: str = "sim", index: int = 0) -> BaseCamera:
    """Crea la cámara apropiada según el identificador de fuente."""
    if source == "realsense":
        return RealSenseCamera()
    if source == "webcam":
        return WebcamCamera(index)
    return SimulatedCamera()


def list_available_cameras() -> List[str]:
    """Lista todas las fuentes de cámara disponibles."""
    sources = ["SIM — Cámara simulada"]
    if CV2_AVAILABLE:
        for i in range(4):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                sources.append(f"CAM{i} — Webcam {i}")
                cap.release()
    if REALSENSE_AVAILABLE:
        try:
            ctx = rs.context()
            for dev in ctx.devices:
                name = dev.get_info(rs.camera_info.name)
                sources.append(f"REALSENSE — {name}")
        except Exception:
            pass
    return sources
