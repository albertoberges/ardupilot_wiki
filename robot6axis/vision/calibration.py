"""
Calibración mano-ojo (hand-eye calibration).

Calcula la transformada rígida 4×4 que mapea coordenadas de cámara
→ coordenadas de la base del robot, a partir de correspondencias
(punto_cámara, punto_robot) recogidas manualmente.

Algoritmo: SVD sobre la matriz de covarianza (método de Umeyama).

Uso típico:
    1. Crear instancia:      calib = HandEyeCalibration()
    2. Recoger puntos:       calib.add_point(robot_xyz, camera_xyz)  × 8+
    3. Calcular:             ok, msg = calib.compute()
    4. Usar:                 p_robot = calib.camera_to_robot(p_cam)
    5. Guardar/cargar:       calib.save() / calib.load()
"""

import json
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path


class HandEyeCalibration:
    """Calibración mano-ojo mediante correspondencias de puntos."""

    CALIB_FILE  = "calibration.json"
    MIN_POINTS  = 4

    def __init__(self):
        self._T: Optional[np.ndarray] = None     # Transformada 4×4
        self._pts_robot:  List[np.ndarray] = []
        self._pts_camera: List[np.ndarray] = []
        self._error_mm = float("inf")

    # ------------------------------------------------------------------ #
    # Estado                                                               #
    # ------------------------------------------------------------------ #

    @property
    def is_calibrated(self) -> bool:
        return self._T is not None

    @property
    def error_mm(self) -> float:
        return self._error_mm

    @property
    def num_points(self) -> int:
        return len(self._pts_robot)

    def status_text(self) -> str:
        if not self.is_calibrated:
            return f"Sin calibrar  ({self.num_points} puntos recogidos)"
        return f"Calibrado ✓  |  Error: {self._error_mm:.1f} mm  |  {self.num_points} puntos"

    # ------------------------------------------------------------------ #
    # Recolección de puntos                                                #
    # ------------------------------------------------------------------ #

    def add_point(self, robot_xyz: np.ndarray, camera_xyz: np.ndarray):
        """Añade un par de correspondencia (robot, cámara)."""
        self._pts_robot.append(np.asarray(robot_xyz,  float).copy())
        self._pts_camera.append(np.asarray(camera_xyz, float).copy())

    def clear_points(self):
        self._pts_robot.clear()
        self._pts_camera.clear()
        self._T = None

    def remove_last_point(self):
        if self._pts_robot:
            self._pts_robot.pop()
            self._pts_camera.pop()

    # ------------------------------------------------------------------ #
    # Cálculo (SVD / Umeyama)                                             #
    # ------------------------------------------------------------------ #

    def compute(self) -> Tuple[bool, str]:
        """
        Calcula la transformada rígida a partir de los puntos recogidos.
        Devuelve (éxito, mensaje).
        """
        n = self.num_points
        if n < self.MIN_POINTS:
            return False, f"Necesitas al menos {self.MIN_POINTS} puntos (tienes {n})"

        src = np.array(self._pts_camera)  # (n, 3)
        dst = np.array(self._pts_robot)   # (n, 3)

        # Centroides
        src_c = src.mean(axis=0)
        dst_c = dst.mean(axis=0)

        # Matriz de covarianza cruzada
        H = (src - src_c).T @ (dst - dst_c)

        # SVD → rotación óptima
        U, _, Vt = np.linalg.svd(H)
        R = Vt.T @ U.T

        # Corregir reflexión si det(R) < 0
        if np.linalg.det(R) < 0:
            Vt[-1, :] *= -1
            R = Vt.T @ U.T

        # Traslación
        t = dst_c - R @ src_c

        # Ensamblar transformada 4×4
        self._T = np.eye(4)
        self._T[:3, :3] = R
        self._T[:3,  3] = t

        # Error de reproyección
        errors = [
            np.linalg.norm(self.camera_to_robot(pc) - pr)
            for pc, pr in zip(self._pts_camera, self._pts_robot)
        ]
        self._error_mm = float(np.mean(errors))

        return True, f"Calibración completada. Error medio: {self._error_mm:.1f} mm"

    # ------------------------------------------------------------------ #
    # Transformación                                                       #
    # ------------------------------------------------------------------ #

    def camera_to_robot(self, p_cam: np.ndarray) -> np.ndarray:
        """Transforma un punto 3D de coordenadas cámara a coordenadas robot."""
        if self._T is None:
            return np.asarray(p_cam, float).copy()
        p = np.append(np.asarray(p_cam, float), 1.0)
        return (self._T @ p)[:3]

    # ------------------------------------------------------------------ #
    # Persistencia                                                         #
    # ------------------------------------------------------------------ #

    def save(self, path: str = CALIB_FILE) -> bool:
        if self._T is None:
            return False
        data = {
            "transform":          self._T.tolist(),
            "reprojection_error": self._error_mm,
            "num_points":         self.num_points,
            "points_robot":       [p.tolist() for p in self._pts_robot],
            "points_camera":      [p.tolist() for p in self._pts_camera],
        }
        Path(path).write_text(json.dumps(data, indent=2))
        return True

    def load(self, path: str = CALIB_FILE) -> bool:
        try:
            data = json.loads(Path(path).read_text())
            self._T         = np.array(data["transform"])
            self._error_mm  = data.get("reprojection_error", float("inf"))
            self._pts_robot  = [np.array(p) for p in data.get("points_robot",  [])]
            self._pts_camera = [np.array(p) for p in data.get("points_camera", [])]
            return True
        except Exception:
            return False
