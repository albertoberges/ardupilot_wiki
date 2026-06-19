"""
Detección de objetos con YOLO v8 (Ultralytics) y fallback por color HSV.

Si ultralytics está instalado  → usa YOLO v8n (se descarga automáticamente)
Si no está instalado            → usa detector de color HSV (funciona con la cámara simulada)
"""

import numpy as np
from typing import List, Optional
from dataclasses import dataclass, field

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from ultralytics import YOLO as _YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


# ================================================================== #
# Resultado de detección                                               #
# ================================================================== #

@dataclass
class Detection:
    """Un objeto detectado en la imagen."""
    class_name: str
    confidence: float
    bbox: tuple          # (x1, y1, x2, y2) en píxeles
    center: tuple        # (cx, cy) en píxeles

    # Accesores de conveniencia
    @property
    def x1(self): return self.bbox[0]
    @property
    def y1(self): return self.bbox[1]
    @property
    def x2(self): return self.bbox[2]
    @property
    def y2(self): return self.bbox[3]
    @property
    def cx(self): return self.center[0]
    @property
    def cy(self): return self.center[1]
    @property
    def width(self):  return self.x2 - self.x1
    @property
    def height(self): return self.y2 - self.y1
    @property
    def area(self): return self.width * self.height


# ================================================================== #
# Detector YOLO v8                                                     #
# ================================================================== #

class YOLODetector:
    """
    Detector basado en YOLOv8n de Ultralytics.
    Los pesos se descargan automáticamente en el primer uso (~6 MB).
    """

    MODEL_PATH  = "yolov8n.pt"   # Nano = más rápido, menos VRAM
    DEFAULT_CONF = 0.45

    def __init__(self, conf: float = DEFAULT_CONF):
        self._model = None
        self._conf  = conf
        self._filter_classes: Optional[List[str]] = None

    def load(self) -> bool:
        """Carga el modelo YOLO. Descarga los pesos si no existen."""
        if not YOLO_AVAILABLE:
            return False
        try:
            self._model = _YOLO(self.MODEL_PATH)
            return True
        except Exception:
            return False

    @property
    def ready(self) -> bool:
        return self._model is not None

    def set_class_filter(self, classes: Optional[List[str]]):
        """Filtra las detecciones a las clases indicadas. None = todas."""
        self._filter_classes = classes

    def detect(self, image: np.ndarray) -> List[Detection]:
        if not self.ready or not CV2_AVAILABLE:
            return []

        results = self._model(image, conf=self._conf, verbose=False)[0]
        out = []
        for box in results.boxes:
            cid  = int(box.cls[0])
            name = results.names[cid]
            if self._filter_classes and name not in self._filter_classes:
                continue
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            out.append(Detection(
                class_name=name,
                confidence=conf,
                bbox=(x1, y1, x2, y2),
                center=((x1 + x2) // 2, (y1 + y2) // 2),
            ))
        return out


# ================================================================== #
# Detector por color HSV (fallback)                                    #
# ================================================================== #

class ColorDetector:
    """
    Detector por umbralización de color HSV.
    No requiere GPU ni modelos — funciona con la cámara simulada.
    """

    # Rangos HSV: [H_min, S_min, V_min], [H_max, S_max, V_max]
    COLORS = {
        "rojo":       (([0,  80, 80],  [12, 255, 255]), ([168, 80, 80], [180, 255, 255])),
        "azul":       (([100, 70, 70], [130, 255, 255]), None),
        "verde":      (([38,  60, 60], [82,  255, 255]), None),
        "amarillo":   (([18,  80, 80], [36,  255, 255]), None),
        "naranja":    (([12, 100, 80], [20,  255, 255]), None),
        "cyan":       (([82,  60, 60], [100, 255, 255]), None),
    }

    MIN_AREA = 350

    def detect(self, image: np.ndarray) -> List[Detection]:
        if not CV2_AVAILABLE:
            return []

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        kernel = np.ones((5, 5), np.uint8)
        out: List[Detection] = []

        for color_name, (range1, range2) in self.COLORS.items():
            mask = cv2.inRange(hsv, np.array(range1[0]), np.array(range1[1]))
            if range2:
                mask2 = cv2.inRange(hsv, np.array(range2[0]), np.array(range2[1]))
                mask  = cv2.bitwise_or(mask, mask2)

            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < self.MIN_AREA:
                    continue
                x, y, w, h = cv2.boundingRect(cnt)
                out.append(Detection(
                    class_name=color_name,
                    confidence=min(1.0, area / 4000),
                    bbox=(x, y, x + w, y + h),
                    center=(x + w // 2, y + h // 2),
                ))

        return sorted(out, key=lambda d: d.confidence, reverse=True)


# ================================================================== #
# Detector combinado (interfaz pública)                               #
# ================================================================== #

class ObjectDetector:
    """
    Orquesta YOLO y el detector de color.
    Intenta cargar YOLO; si falla, usa el detector de color como fallback.
    Procesa solo 1 de cada N frames para no saturar la CPU.
    """

    SKIP_FRAMES = 3   # Ejecutar detección cada 3 frames

    def __init__(self, use_yolo: bool = True):
        self._yolo  = YOLODetector() if use_yolo else None
        self._color = ColorDetector()
        self._mode  = "none"
        self._skip  = 0
        self._cache: List[Detection] = []

    # ---- Inicialización ---- #

    def initialize(self) -> str:
        """Carga el modelo. Devuelve 'yolo', 'color' o 'none'."""
        if self._yolo and self._yolo.load():
            self._mode = "yolo"
        elif CV2_AVAILABLE:
            self._mode = "color"
        else:
            self._mode = "none"
        return self._mode

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def mode_label(self) -> str:
        labels = {
            "yolo":  "YOLO v8  ✓",
            "color": "Color HSV  (instale ultralytics para YOLO)",
            "none":  "Sin detector — instale opencv-python",
        }
        return labels.get(self._mode, self._mode)

    # ---- Detección ---- #

    def detect(self, image: np.ndarray, force: bool = False) -> List[Detection]:
        """
        Detecta objetos en la imagen BGR dada.
        Usa caché entre frames para reducir carga de CPU.
        """
        self._skip += 1
        if not force and self._skip % self.SKIP_FRAMES != 0:
            return self._cache

        if self._mode == "yolo":
            self._cache = self._yolo.detect(image)
        elif self._mode == "color":
            self._cache = self._color.detect(image)
        else:
            self._cache = []

        return self._cache

    # ---- Visualización ---- #

    def draw(self, image: np.ndarray, detections: List[Detection],
             selected: int = -1) -> np.ndarray:
        """
        Dibuja bounding boxes, etiquetas y mira del objeto seleccionado.
        Devuelve una copia de la imagen con las anotaciones.
        """
        if not CV2_AVAILABLE or not detections:
            return image

        vis = image.copy()

        for i, det in enumerate(detections):
            sel  = (i == selected)
            col  = (0, 210, 255) if sel else (0, 230, 80)
            thick = 3 if sel else 2

            # Caja
            cv2.rectangle(vis, (det.x1, det.y1), (det.x2, det.y2), col, thick)

            # Etiqueta con fondo
            label = f"{det.class_name}  {det.confidence:.0%}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 1)
            cv2.rectangle(vis, (det.x1, det.y1 - th - 8),
                          (det.x1 + tw + 6, det.y1), col, -1)
            cv2.putText(vis, label, (det.x1 + 3, det.y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 0, 0), 1)

            # Cruz en el centro
            cv2.drawMarker(vis, det.center, col, cv2.MARKER_CROSS, 14, 2)

            # Círculo extra si está seleccionado
            if sel:
                cv2.circle(vis, det.center, 22, col, 2)

        return vis
