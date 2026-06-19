#!/usr/bin/env python3
"""
Robot 6 Ejes — Controlador
===========================
Sistema de control para robot industrial de 6 grados de libertad.
Interfaz estilo ABB RobotStudio / FlexPendant.

Uso:
    python3 main.py

Dependencias:
    pip install PyQt6 numpy matplotlib pyserial opencv-python
    pip install ultralytics   # opcional, para detección YOLO v8
"""

import sys
import os
import platform

# Asegurar que el directorio del proyecto esté en el path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---- Ajustes específicos de macOS ---- #
if platform.system() == "Darwin":
    # Necesario en macOS para que matplotlib use el backend Qt correctamente
    os.environ.setdefault("MPLBACKEND", "QtAgg")
    # Evita advertencias de accesibilidad en la consola
    os.environ.setdefault("QT_MAC_WANTS_LAYER", "1")

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QPalette, QColor


def main():
    # Soporte de alta resolución (Retina en MacBook, 4K en Windows/Linux)
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("Robot 6 Ejes - Controlador")
    app.setApplicationVersion("1.0")
    app.setOrganizationName("RobotControl")

    # Usar estilo Fusion (consistente en todos los SO)
    app.setStyle("Fusion")

    # Paleta oscura base
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window,          QColor("#1a1a2e"))
    palette.setColor(QPalette.ColorRole.WindowText,      QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Base,            QColor("#0d1117"))
    palette.setColor(QPalette.ColorRole.AlternateBase,   QColor("#16213e"))
    palette.setColor(QPalette.ColorRole.Text,            QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Button,          QColor("#0f3460"))
    palette.setColor(QPalette.ColorRole.ButtonText,      QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Highlight,       QColor("#0078d4"))
    palette.setColor(QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
    palette.setColor(QPalette.ColorRole.ToolTipBase,     QColor("#0f3460"))
    palette.setColor(QPalette.ColorRole.ToolTipText,     QColor("#e0e0e0"))
    app.setPalette(palette)

    # Fuente: SF Pro en Mac, Segoe UI en Windows, system en Linux
    if platform.system() == "Darwin":
        font = QFont(".AppleSystemUIFont", 13)
    elif platform.system() == "Windows":
        font = QFont("Segoe UI", 10)
    else:
        font = QFont("Ubuntu", 10)
    app.setFont(font)

    from gui.main_window import MainWindow
    window = MainWindow()
    window.showMaximized()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
