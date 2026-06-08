"""
Cinemática de robot de 6 GDL con parámetros Denavit-Hartenberg.
Basado en geometría similar a ABB IRB 120.
"""

import numpy as np


class Robot6DOF:
    """Robot de 6 grados de libertad con cinemática DH e IK numérica."""

    # Parámetros DH: [a(mm), d(mm), alpha(rad), theta_offset(rad)]
    DH_PARAMS = [
        [0,     290,  -np.pi/2,  0         ],  # Eje 1 - rotación base
        [270,   0,     0,        -np.pi/2  ],  # Eje 2 - hombro
        [70,    0,     np.pi/2,   0        ],  # Eje 3 - codo
        [0,     302,  -np.pi/2,  0         ],  # Eje 4 - muñeca 1
        [0,     0,     np.pi/2,  0         ],  # Eje 5 - muñeca 2
        [0,     72,    0,        0         ],  # Eje 6 - muñeca 3
    ]

    # Límites articulares [min, max] en grados
    JOINT_LIMITS = [
        [-165, 165],
        [-110, 110],
        [-110,  70],
        [-160, 160],
        [-120, 120],
        [-400, 400],
    ]

    # Nombres de los ejes
    JOINT_NAMES = ["J1 - Base", "J2 - Hombro", "J3 - Codo",
                   "J4 - Muñeca 1", "J5 - Muñeca 2", "J6 - Muñeca 3"]

    def __init__(self):
        self.dh = np.array(self.DH_PARAMS, dtype=float)
        self.limits = np.array(self.JOINT_LIMITS, dtype=float)
        self._q = np.zeros(6)       # Ángulos articulares en grados
        self._tcp = np.zeros(6)     # Pose TCP [x,y,z,rx,ry,rz] mm/grados
        self._update_tcp()

    # ------------------------------------------------------------------ #
    # Propiedades                                                          #
    # ------------------------------------------------------------------ #

    @property
    def joint_angles(self) -> np.ndarray:
        return self._q.copy()

    @property
    def tcp_pose(self) -> np.ndarray:
        """[X, Y, Z (mm), Rx, Ry, Rz (grados)] del TCP"""
        return self._tcp.copy()

    # ------------------------------------------------------------------ #
    # Cinemática directa                                                   #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _dh_matrix(a: float, d: float, alpha: float, theta: float) -> np.ndarray:
        ct, st = np.cos(theta), np.sin(theta)
        ca, sa = np.cos(alpha), np.sin(alpha)
        return np.array([
            [ct, -st*ca,  st*sa, a*ct],
            [st,  ct*ca, -ct*sa, a*st],
            [0,   sa,     ca,    d   ],
            [0,   0,      0,     1   ]
        ])

    def forward_kinematics(self, q_deg=None) -> np.ndarray:
        """Devuelve la matriz de transformación 4×4 del extremo."""
        if q_deg is None:
            q_deg = self._q
        T = np.eye(4)
        for i, (a, d, alpha, t_off) in enumerate(self.dh):
            T = T @ self._dh_matrix(a, d, alpha, np.radians(q_deg[i]) + t_off)
        return T

    def get_all_transforms(self, q_deg=None) -> list:
        """Devuelve lista de transformadas 4×4 para cada articulación."""
        if q_deg is None:
            q_deg = self._q
        transforms = [np.eye(4)]
        T = np.eye(4)
        for i, (a, d, alpha, t_off) in enumerate(self.dh):
            T = T @ self._dh_matrix(a, d, alpha, np.radians(q_deg[i]) + t_off)
            transforms.append(T.copy())
        return transforms

    def get_link_positions(self, q_deg=None) -> np.ndarray:
        """Posiciones XYZ de cada origen articular (para visualización)."""
        return np.array([T[:3, 3] for T in self.get_all_transforms(q_deg)])

    # ------------------------------------------------------------------ #
    # Cinemática inversa numérica (mínimos cuadrados amortiguados)        #
    # ------------------------------------------------------------------ #

    def _jacobian(self, q_deg: np.ndarray, eps: float = 1e-4) -> np.ndarray:
        """Jacobiano numérico de posición (3×6)."""
        p0 = self.forward_kinematics(q_deg)[:3, 3]
        J = np.zeros((3, 6))
        for i in range(6):
            qp = q_deg.copy()
            qp[i] += np.degrees(eps)
            J[:, i] = (self.forward_kinematics(qp)[:3, 3] - p0) / eps
        return J

    def inverse_kinematics(self, target_xyz, q_init=None,
                           max_iter: int = 400, tol: float = 0.5):
        """
        IK por mínimos cuadrados amortiguados (Levenberg-Marquardt).
        Retorna (q_deg, success).
        """
        q = (self._q.copy() if q_init is None else np.asarray(q_init, float).copy())
        lam = 0.05  # factor de amortiguamiento

        for _ in range(max_iter):
            err = np.asarray(target_xyz, float) - self.forward_kinematics(q)[:3, 3]
            if np.linalg.norm(err) < tol:
                return q, True
            J = self._jacobian(q)
            dq_rad = J.T @ np.linalg.solve(J @ J.T + lam**2 * np.eye(3), err)
            dq = np.degrees(dq_rad) * 0.4  # paso conservador
            q = np.clip(q + dq, self.limits[:, 0], self.limits[:, 1])

        final_err = np.linalg.norm(np.asarray(target_xyz) - self.forward_kinematics(q)[:3, 3])
        return q, final_err < tol * 5

    # ------------------------------------------------------------------ #
    # Utilidades de rotación                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _rot_to_euler_zyx(R: np.ndarray):
        """Matriz de rotación → Euler ZYX en grados."""
        sy = np.sqrt(R[0, 0]**2 + R[1, 0]**2)
        if sy > 1e-6:
            rx = np.degrees(np.arctan2(R[2, 1], R[2, 2]))
            ry = np.degrees(np.arctan2(-R[2, 0], sy))
            rz = np.degrees(np.arctan2(R[1, 0], R[0, 0]))
        else:
            rx = np.degrees(np.arctan2(-R[1, 2], R[1, 1]))
            ry = np.degrees(np.arctan2(-R[2, 0], sy))
            rz = 0.0
        return rx, ry, rz

    def _update_tcp(self):
        T = self.forward_kinematics(self._q)
        p = T[:3, 3]
        rx, ry, rz = self._rot_to_euler_zyx(T[:3, :3])
        self._tcp = np.array([p[0], p[1], p[2], rx, ry, rz])

    # ------------------------------------------------------------------ #
    # Control de movimiento                                                #
    # ------------------------------------------------------------------ #

    def set_joints(self, q_deg):
        """Establece ángulos articulares con saturación en límites."""
        self._q = np.clip(np.asarray(q_deg, float), self.limits[:, 0], self.limits[:, 1])
        self._update_tcp()

    def jog_joint(self, joint_idx: int, delta_deg: float):
        """Mueve un eje en incremento de delta_deg grados."""
        q = self._q.copy()
        q[joint_idx] = np.clip(q[joint_idx] + delta_deg,
                                self.limits[joint_idx, 0], self.limits[joint_idx, 1])
        self.set_joints(q)

    def jog_cartesian(self, delta_xyz) -> bool:
        """
        Mueve el TCP en espacio cartesiano (mm).
        Usa IK para encontrar la nueva configuración.
        """
        T = self.forward_kinematics(self._q)
        target = T[:3, 3] + np.asarray(delta_xyz, float)
        q_new, ok = self.inverse_kinematics(target, q_init=self._q)
        if ok:
            self.set_joints(q_new)
        return ok

    def move_home(self):
        """Mueve a posición home (todos los ejes a 0°)."""
        self.set_joints(np.zeros(6))

    def is_within_limits(self, q_deg) -> bool:
        q = np.asarray(q_deg)
        return bool(np.all(q >= self.limits[:, 0]) and np.all(q <= self.limits[:, 1]))

    def get_workspace_radius(self) -> float:
        """Radio aproximado del espacio de trabajo en mm."""
        return float(np.sum(np.abs(self.dh[:, 0])) + np.sum(np.abs(self.dh[:, 1])) * 0.5)
