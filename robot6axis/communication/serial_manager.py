"""
Gestión de comunicación serie con el hardware del robot.
Protocolo de texto simple compatible con el firmware Arduino.
"""

import threading
import time
from typing import Callable, Optional
import numpy as np

try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


class SerialManager:
    """
    Gestiona la comunicación serie con el controlador del robot.

    Protocolo:
        PC → Robot:  "J1.23,2.45,3.67,4.89,5.12,6.34\\n"  (ángulos en grados)
        Robot → PC:  "OK J1.23,2.45,...\\n"  (confirmación + posición actual)
        Robot → PC:  "ERR mensaje\\n"         (error)
        Robot → PC:  "INFO mensaje\\n"        (información)
    """

    BAUD_RATE = 115200
    TIMEOUT = 2.0

    def __init__(self):
        self._port: Optional[object] = None
        self._connected = False
        self._lock = threading.Lock()
        self._rx_thread: Optional[threading.Thread] = None
        self._running = False
        self._on_message: Optional[Callable] = None
        self._on_status: Optional[Callable] = None

    # ------------------------------------------------------------------ #
    # Conexión                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def list_ports() -> list:
        """Lista puertos serie disponibles."""
        if not SERIAL_AVAILABLE:
            return []
        return [p.device for p in serial.tools.list_ports.comports()]

    def connect(self, port: str) -> bool:
        """Abre el puerto serie. Devuelve True si tiene éxito."""
        if not SERIAL_AVAILABLE:
            return False
        try:
            self._port = serial.Serial(port, self.BAUD_RATE, timeout=self.TIMEOUT)
            time.sleep(2.0)  # Esperar reset Arduino
            self._connected = True
            self._running = True
            self._rx_thread = threading.Thread(target=self._rx_loop, daemon=True)
            self._rx_thread.start()
            self._notify_status(f"Conectado a {port}")
            return True
        except Exception as e:
            self._notify_status(f"Error de conexión: {e}")
            return False

    def disconnect(self):
        """Cierra la conexión serie."""
        self._running = False
        self._connected = False
        if self._port and self._port.is_open:
            self._port.close()
        self._notify_status("Desconectado")

    @property
    def connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------ #
    # Envío de comandos                                                    #
    # ------------------------------------------------------------------ #

    def send_joints(self, q_deg: np.ndarray) -> bool:
        """Envía ángulos articulares al robot."""
        if not self._connected:
            return False
        cmd = "J" + ",".join(f"{v:.2f}" for v in q_deg) + "\n"
        return self._send(cmd)

    def send_home(self) -> bool:
        """Envía comando de home."""
        return self._send("HOME\n")

    def send_estop(self) -> bool:
        """Envía parada de emergencia."""
        return self._send("ESTOP\n")

    def send_enable(self) -> bool:
        """Habilita el robot."""
        return self._send("ENABLE\n")

    def _send(self, data: str) -> bool:
        if not self._connected:
            return False
        try:
            with self._lock:
                self._port.write(data.encode())
            return True
        except Exception as e:
            self._notify_status(f"Error TX: {e}")
            self._connected = False
            return False

    # ------------------------------------------------------------------ #
    # Recepción de datos                                                   #
    # ------------------------------------------------------------------ #

    def _rx_loop(self):
        """Hilo de recepción de datos."""
        while self._running and self._port and self._port.is_open:
            try:
                line = self._port.readline().decode(errors="replace").strip()
                if line and self._on_message:
                    self._on_message(line)
            except Exception:
                if self._running:
                    self._connected = False
                    self._notify_status("Conexión perdida")
                break

    def set_message_callback(self, callback: Callable):
        """Callback llamado con cada línea recibida del robot."""
        self._on_message = callback

    def set_status_callback(self, callback: Callable):
        """Callback para mensajes de estado de la conexión."""
        self._on_status = callback

    def _notify_status(self, msg: str):
        if self._on_status:
            self._on_status(msg)


class SimulatedSerial:
    """
    Simulador de conexión serie para pruebas sin hardware.
    Compatible con la interfaz de SerialManager.
    """

    def __init__(self):
        self._connected = False
        self._on_message = None
        self._on_status = None

    def connect(self, port: str = "SIM") -> bool:
        self._connected = True
        self._notify_status("Simulador conectado (sin hardware)")
        return True

    def disconnect(self):
        self._connected = False
        self._notify_status("Simulador desconectado")

    @property
    def connected(self) -> bool:
        return self._connected

    def send_joints(self, q_deg) -> bool:
        if not self._connected:
            return False
        response = "OK J" + ",".join(f"{v:.2f}" for v in q_deg)
        if self._on_message:
            threading.Timer(0.02, lambda: self._on_message(response)).start()
        return True

    def send_home(self) -> bool:
        if self._on_message:
            threading.Timer(0.02, lambda: self._on_message("OK HOME")).start()
        return True

    def send_estop(self) -> bool:
        if self._on_message:
            threading.Timer(0.01, lambda: self._on_message("OK ESTOP")).start()
        return True

    def send_enable(self) -> bool:
        if self._on_message:
            threading.Timer(0.01, lambda: self._on_message("OK ENABLE")).start()
        return True

    def set_message_callback(self, cb): self._on_message = cb
    def set_status_callback(self, cb): self._on_status = cb
    def _notify_status(self, msg):
        if self._on_status: self._on_status(msg)
    @staticmethod
    def list_ports(): return ["SIM - Simulador"]
