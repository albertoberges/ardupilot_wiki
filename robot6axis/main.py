#!/usr/bin/env python3
"""
Robot 6 Ejes — Controlador
===========================
Sistema de control para robot industrial de 6 grados de libertad.
Interfaz estilo ABB RobotStudio / FlexPendant.

Uso:
    python main.py

Dependencias:
    pip install PyQt6 numpy matplotlib pyserial
"""

import sys
import os

# Asegurar que el directorio del proyecto esté en el path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication, QSplashScreen
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Robot 6 Ejes - Controlador")
    app.setApplicationVersion("1.0")
    app.setOrganizationName("RobotControl")

    # Usar estilo Fusion como base para la personalización
    app.setStyle("Fusion")

    # Paleta base oscura para widgets nativos que no captura QSS
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor("#1a1a2e"))
    palette.setColor(QPalette.ColorRole.WindowText, QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Base, QColor("#0d1117"))
    palette.setColor(QPalette.ColorRole.AlternateBase, QColor("#16213e"))
    palette.setColor(QPalette.ColorRole.Text, QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Button, QColor("#0f3460"))
    palette.setColor(QPalette.ColorRole.ButtonText, QColor("#e0e0e0"))
    palette.setColor(QPalette.ColorRole.Highlight, QColor("#0078d4"))
    palette.setColor(QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
    app.setPalette(palette)

    # Fuente por defecto
    font = QFont("Segoe UI", 10)
    app.setFont(font)

    # Importar aquí para que el splash se muestre antes
    from gui.main_window import MainWindow
    window = MainWindow()
    window.showMaximized()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
