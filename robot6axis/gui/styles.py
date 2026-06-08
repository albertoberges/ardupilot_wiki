"""
Estilos visuales estilo ABB RobotStudio (tema oscuro con acentos azules).
"""

MAIN_STYLE = """
/* ===== GLOBAL ===== */
QMainWindow, QWidget {
    background-color: #1a1a2e;
    color: #e0e0e0;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
}
QMainWindow::separator {
    background-color: #0f3460;
    width: 3px;
    height: 3px;
}

/* ===== DOCK WIDGETS ===== */
QDockWidget {
    background-color: #16213e;
    color: #e0e0e0;
}
QDockWidget::title {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #0f3460, stop:1 #0a2040);
    color: #7ec8e3;
    padding: 7px 10px;
    font-weight: bold;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-bottom: 1px solid #0078d4;
}

/* ===== BOTONES ===== */
QPushButton {
    background-color: #0f3460;
    color: #e0e0e0;
    border: 1px solid #1a4a8a;
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 13px;
    min-width: 70px;
}
QPushButton:hover { background-color: #1a4a8a; border-color: #0078d4; }
QPushButton:pressed { background-color: #0078d4; }
QPushButton:disabled { background-color: #2a2a3e; color: #555570; border-color: #2a2a3e; }

QPushButton[class="danger"] {
    background-color: #7a0000;
    border: 2px solid #cc0000;
    color: #ffaaaa;
    font-weight: bold;
}
QPushButton[class="danger"]:hover { background-color: #cc0000; color: white; }
QPushButton[class="danger"]:pressed { background-color: #ff0000; }

QPushButton[class="success"] {
    background-color: #004d20;
    border: 1px solid #007a33;
    color: #80ffb0;
}
QPushButton[class="success"]:hover { background-color: #007a33; color: white; }

QPushButton[class="warning"] {
    background-color: #5a3000;
    border: 1px solid #b36000;
    color: #ffb040;
}
QPushButton[class="warning"]:hover { background-color: #b36000; }

QPushButton[class="home"] {
    background-color: #30005a;
    border: 2px solid #8040c0;
    color: #c080ff;
    font-weight: bold;
}
QPushButton[class="home"]:hover { background-color: #5000a0; }

/* ===== SLIDERS ===== */
QSlider::groove:horizontal {
    background-color: #0f3460;
    height: 8px;
    border-radius: 4px;
    border: none;
}
QSlider::handle:horizontal {
    background-color: #0078d4;
    width: 20px;
    height: 20px;
    margin: -6px 0;
    border-radius: 10px;
    border: 2px solid #7ec8e3;
}
QSlider::sub-page:horizontal {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #003a70, stop:1 #0078d4);
    border-radius: 4px;
}
QSlider::groove:vertical {
    background-color: #0f3460;
    width: 8px;
    border-radius: 4px;
}
QSlider::handle:vertical {
    background-color: #0078d4;
    width: 20px;
    height: 20px;
    margin: 0 -6px;
    border-radius: 10px;
    border: 2px solid #7ec8e3;
}
QSlider::sub-page:vertical {
    background: qlineargradient(x1:0, y1:1, x2:0, y2:0,
        stop:0 #003a70, stop:1 #0078d4);
    border-radius: 4px;
}

/* ===== COMBO BOX ===== */
QComboBox {
    background-color: #0f3460;
    color: #e0e0e0;
    border: 1px solid #1a4a8a;
    padding: 5px 8px;
    border-radius: 4px;
}
QComboBox:hover { border-color: #0078d4; }
QComboBox::drop-down { border: none; width: 22px; }
QComboBox::down-arrow { width: 12px; height: 12px; }
QComboBox QAbstractItemView {
    background-color: #0f3460;
    color: #e0e0e0;
    selection-background-color: #0078d4;
    border: 1px solid #1a4a8a;
    outline: none;
}

/* ===== GROUP BOX ===== */
QGroupBox {
    color: #7ec8e3;
    border: 1px solid #0f3460;
    border-radius: 6px;
    margin-top: 12px;
    padding: 12px 8px 8px 8px;
    font-weight: bold;
    font-size: 12px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    padding: 2px 8px;
    background-color: #1a1a2e;
    color: #7ec8e3;
    letter-spacing: 1px;
}

/* ===== TAB WIDGET ===== */
QTabWidget::pane {
    border: 1px solid #0f3460;
    background-color: #16213e;
    border-top: none;
}
QTabBar::tab {
    background-color: #0f3460;
    color: #7090a0;
    padding: 8px 20px;
    border: none;
    margin-right: 2px;
    min-width: 100px;
}
QTabBar::tab:selected {
    background-color: #16213e;
    color: #7ec8e3;
    border-top: 2px solid #0078d4;
}
QTabBar::tab:hover:!selected { background-color: #1a4a8a; color: #e0e0e0; }

/* ===== TEXT EDIT ===== */
QTextEdit, QPlainTextEdit {
    background-color: #0d1117;
    color: #d4d4d4;
    border: 1px solid #0f3460;
    border-radius: 4px;
    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    selection-background-color: #264f78;
    line-height: 1.5;
}

/* ===== LINE EDIT ===== */
QLineEdit {
    background-color: #0f3460;
    color: #e0e0e0;
    border: 1px solid #1a4a8a;
    padding: 5px 8px;
    border-radius: 4px;
}
QLineEdit:focus { border-color: #0078d4; }

/* ===== SCROLL BARS ===== */
QScrollBar:vertical {
    background: #0d1117;
    width: 10px;
    border: none;
    border-radius: 5px;
}
QScrollBar::handle:vertical {
    background: #0f3460;
    border-radius: 5px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover { background: #0078d4; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; border: none; }
QScrollBar:horizontal {
    background: #0d1117;
    height: 10px;
    border: none;
}
QScrollBar::handle:horizontal { background: #0f3460; border-radius: 5px; }
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; border: none; }

/* ===== TOOL BAR ===== */
QToolBar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #0f3460, stop:1 #0a2040);
    border-bottom: 2px solid #0078d4;
    padding: 4px 8px;
    spacing: 6px;
}
QToolBar::separator {
    background-color: #0f3460;
    width: 1px;
    margin: 4px 4px;
}

/* ===== MENU BAR ===== */
QMenuBar {
    background-color: #0a2040;
    color: #c0c0c0;
    border-bottom: 1px solid #0f3460;
}
QMenuBar::item:selected { background-color: #0078d4; color: white; }
QMenu {
    background-color: #16213e;
    color: #e0e0e0;
    border: 1px solid #0f3460;
}
QMenu::item:selected { background-color: #0078d4; }
QMenu::separator { background-color: #0f3460; height: 1px; }

/* ===== STATUS BAR ===== */
QStatusBar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #0a2040, stop:1 #061428);
    color: #7ec8e3;
    border-top: 1px solid #0078d4;
    font-size: 12px;
}
QStatusBar::item { border: none; }

/* ===== LABEL ===== */
QLabel { color: #e0e0e0; }

/* ===== LIST / TREE ===== */
QListWidget, QTreeWidget {
    background-color: #0d1117;
    color: #e0e0e0;
    border: 1px solid #0f3460;
    border-radius: 4px;
    alternate-background-color: #111827;
}
QListWidget::item:selected, QTreeWidget::item:selected {
    background-color: #0078d4; color: white;
}
QListWidget::item:hover, QTreeWidget::item:hover {
    background-color: #1a4a8a;
}
QHeaderView::section {
    background-color: #0f3460;
    color: #7ec8e3;
    padding: 4px 8px;
    border: none;
    border-right: 1px solid #1a1a2e;
    font-weight: bold;
}
"""

ESTOP_STYLE = """
QPushButton {
    background: qradialgradient(cx:0.5, cy:0.5, radius:0.5,
        stop:0 #ff2020, stop:0.6 #cc0000, stop:1 #880000);
    color: white;
    border: 4px solid #ff4040;
    border-radius: 55px;
    font-size: 16px;
    font-weight: bold;
    min-width: 110px;
    min-height: 110px;
    text-align: center;
}
QPushButton:hover {
    background: qradialgradient(cx:0.5, cy:0.5, radius:0.5,
        stop:0 #ff5050, stop:0.6 #ff0000, stop:1 #aa0000);
    border-color: #ff8080;
}
QPushButton:pressed {
    background: qradialgradient(cx:0.5, cy:0.5, radius:0.5,
        stop:0 #880000, stop:1 #440000);
    border-color: #cc0000;
}
"""

JOG_BTN_STYLE = """
QPushButton {
    background-color: #162840;
    color: #7ec8e3;
    border: 2px solid #0f3460;
    border-radius: 6px;
    font-size: 22px;
    font-weight: bold;
    min-width: 56px;
    min-height: 56px;
    padding: 0;
}
QPushButton:pressed {
    background-color: #0a5090;
    border-color: #0078d4;
    color: white;
}
QPushButton:disabled {
    color: #2a4a5a;
    border-color: #101828;
    background-color: #0d1520;
}
"""
