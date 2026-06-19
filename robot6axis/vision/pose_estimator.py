"""
Estimador de posición 3D.

Convierte una detección 2D en píxeles → posición 3D en coordenadas del robot (mm).

Dos modos:
  1. Con cámara de profundidad (RealSense): usa el depth real en cada píxel.
  2. Sin profundidad (webcam): asume que los objetos están sobre una mesa plana a Z_tabla.
"""

import numpy as np
from typing import Optional, TYPE_CHECKING

from vision.detector import Detection

if TYPE_CHECKING:
    from vision.camera import BaseCamera
    from vision.calibration import HandEyeCalibration


class PoseEstimator:
    """
    Estima la posición 3D de un objeto detectado y la transforma
    al sistema de coordenadas de la base del robot.
    """

    # Profundidad por defecto si no hay datos de profundidad (mm)
    DEFAULT_DEPTH_MM = 500.0

    def __init__(self, camera, calibration=None):
        """
        Args:
            camera      : instancia de BaseCamera (proporciona intrínsecos y depth)
            calibration : instancia de HandEyeCalibration (transforma cámara → robot)
        """
        self.camera      = camera
        self.calibration = calibration

        # Parámetros de la escena (ajustar según el setup real)
        self.approach_offset_mm = 60.0   # El robot se detiene a esta altura sobre el objeto

    # ------------------------------------------------------------------ #
    # Interfaz principal                                                   #
    # ------------------------------------------------------------------ #

    def estimate(self, detection: Detection,
                 depth_frame: Optional[np.ndarray] = None) -> Optional[np.ndarray]:
        """
        Estima la posición 3D del centro de la detección en coordenadas del robot.

        Returns:
            np.ndarray [X, Y, Z] en mm, o None si no es posible estimarla.
        """
        u, v = detection.center

        # 1. Obtener profundidad
        depth_mm = self._sample_depth(u, v, depth_frame)
        if depth_mm is None or depth_mm <= 0:
            return None

        # 2. Retroproyectar al sistema de la cámara
        p_cam = self.camera.pixel_to_3d(u, v, depth_mm)

        # 3. Transformar al sistema del robot
        if self.calibration and self.calibration.is_calibrated:
            p_robot = self.calibration.camera_to_robot(p_cam)
        else:
            p_robot = self._default_transform(p_cam)

        # 4. Añadir offset de aproximación en Z (el robot baja hasta el objeto)
        p_robot[2] += self.approach_offset_mm

        return p_robot

    # ------------------------------------------------------------------ #
    # Profundidad                                                          #
    # ------------------------------------------------------------------ #

    def _sample_depth(self, u: int, v: int,
                      depth_frame: Optional[np.ndarray]) -> Optional[float]:
        """Samplea la profundidad en (u, v). Usa la mediana de un parche 9×9."""
        if depth_frame is not None:
            h, w = depth_frame.shape
            r = 4
            patch = depth_frame[max(0, v-r):min(h, v+r+1),
                                 max(0, u-r):min(w, u+r+1)]
            valid = patch[patch > 0]
            if len(valid) > 0:
                return float(np.median(valid))

        # Sin depth_frame: usar la constante de la cámara simulada o el default
        return getattr(self.camera, 'TABLE_DEPTH_MM', self.DEFAULT_DEPTH_MM)

    # ------------------------------------------------------------------ #
    # Transformada por defecto (sin calibración)                           #
    # ------------------------------------------------------------------ #

    def _default_transform(self, p_cam: np.ndarray) -> np.ndarray:
        """
        Transformada aproximada asumiendo que la cámara mira hacia abajo
        y está montada sobre la base del robot.

        ⚠ Ajusta estos offsets a tu instalación real, o usa la calibración
          mano-ojo para mayor precisión.
        """
        # Offsets de la cámara respecto a la base del robot (mm)
        CAM_X =   0.0   # Lateral
        CAM_Y = 200.0   # Frontal
        CAM_Z = 600.0   # Altura

        x = p_cam[0] + CAM_X
        y = p_cam[1] + CAM_Y
        z = CAM_Z - p_cam[2]   # Invertir Z (cámara mira hacia abajo)

        return np.array([x, y, z])
