/**
 * Controlador de Robot de 6 Ejes - Firmware Arduino
 * ====================================================
 *
 * Hardware soportado:
 *   - Arduino Mega 2560 (recomendado, 6+ salidas PWM)
 *   - Servos: J1-J6 → pines 2, 3, 4, 5, 6, 7
 *   - LED de estado: pin 13
 *   - Buzzer (opcional): pin 8
 *
 * Protocolo serie (115200 baud):
 *   PC → Arduino:  "J<j1>,<j2>,<j3>,<j4>,<j5>,<j6>\n"   (ángulos en grados)
 *   PC → Arduino:  "HOME\n"                               (ir a cero)
 *   PC → Arduino:  "ESTOP\n"                              (parada de emergencia)
 *   PC → Arduino:  "ENABLE\n"                             (habilitar)
 *   Arduino → PC:  "OK J<j1>,...\n"                       (confirmación)
 *   Arduino → PC:  "ERR <mensaje>\n"                      (error)
 *   Arduino → PC:  "INFO <mensaje>\n"                     (información)
 *
 * Para servos industriales reemplazar Servo.h con el driver apropiado.
 */

#include <Servo.h>

// ================================================================== //
// CONFIGURACIÓN DEL HARDWARE                                          //
// ================================================================== //

const int NUM_JOINTS = 6;
const int SERVO_PINS[NUM_JOINTS] = {2, 3, 4, 5, 6, 7};
const int LED_PIN = 13;
const int BUZZER_PIN = 8;

// Límites articulares en grados
const float JOINT_MIN[NUM_JOINTS] = {-165, -110, -110, -160, -120, -360};
const float JOINT_MAX[NUM_JOINTS] = { 165,  110,   70,  160,  120,  360};

// Ángulos de home (posición de reposo segura)
const float HOME_ANGLES[NUM_JOINTS] = {0, 0, 0, 0, 0, 0};

// Configuración del servo (mapeo ángulo robot → microsegundos PWM)
// Ajustar según el servo utilizado
const int SERVO_CENTER_US = 1500;  // Posición central en µs
const float SERVO_US_PER_DEG = 10.0;  // µs por grado (ajustar)

// Velocidad máxima de movimiento (grados por ciclo de 20ms)
const float MAX_SPEED_DEG_PER_STEP = 2.0;

// ================================================================== //
// VARIABLES GLOBALES                                                  //
// ================================================================== //

Servo servos[NUM_JOINTS];

float current_angles[NUM_JOINTS];   // Ángulos actuales
float target_angles[NUM_JOINTS];    // Ángulos objetivo
bool enabled = true;                // Estado habilitado/deshabilitado
bool estop = false;                 // Parada de emergencia

unsigned long last_cmd_time = 0;    // Para watchdog
const unsigned long WATCHDOG_MS = 5000;  // 5s sin comando → home

String cmd_buffer = "";
bool cmd_ready = false;

// ================================================================== //
// SETUP                                                               //
// ================================================================== //

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Inicializar servos y mover a home
  for (int i = 0; i < NUM_JOINTS; i++) {
    servos[i].attach(SERVO_PINS[i]);
    current_angles[i] = HOME_ANGLES[i];
    target_angles[i] = HOME_ANGLES[i];
    write_servo(i, HOME_ANGLES[i]);
  }

  // Secuencia de arranque
  startup_sequence();

  Serial.println("INFO Robot 6 Ejes listo v1.0");
  Serial.println("INFO Esperando comandos...");

  last_cmd_time = millis();
}

// ================================================================== //
// LOOP PRINCIPAL                                                      //
// ================================================================== //

void loop() {
  // Leer comandos serie
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      cmd_ready = true;
    } else if (c != '\r') {
      cmd_buffer += c;
    }
  }

  // Procesar comando
  if (cmd_ready) {
    cmd_buffer.trim();
    if (cmd_buffer.length() > 0) {
      process_command(cmd_buffer);
      last_cmd_time = millis();
    }
    cmd_buffer = "";
    cmd_ready = false;
  }

  // Watchdog: si no hay comunicación, ir a home
  if (millis() - last_cmd_time > WATCHDOG_MS && !estop) {
    // go_home();  // Desactivar si no se desea
  }

  // Mover servos suavemente hacia el objetivo
  if (enabled && !estop) {
    bool moving = false;
    for (int i = 0; i < NUM_JOINTS; i++) {
      float diff = target_angles[i] - current_angles[i];
      if (abs(diff) > 0.1) {
        moving = true;
        float step = constrain(diff, -MAX_SPEED_DEG_PER_STEP, MAX_SPEED_DEG_PER_STEP);
        current_angles[i] += step;
        write_servo(i, current_angles[i]);
      }
    }
    digitalWrite(LED_PIN, moving ? HIGH : LOW);
  }

  delay(20);  // 50 Hz de actualización
}

// ================================================================== //
// PROCESAMIENTO DE COMANDOS                                           //
// ================================================================== //

void process_command(String cmd) {
  cmd.toUpperCase();

  if (cmd == "ESTOP") {
    cmd_estop();
  }
  else if (cmd == "ENABLE") {
    cmd_enable();
  }
  else if (cmd == "HOME") {
    cmd_home();
  }
  else if (cmd == "STATUS") {
    cmd_status();
  }
  else if (cmd.startsWith("J")) {
    cmd_joints(cmd.substring(1));
  }
  else {
    Serial.print("ERR Comando desconocido: ");
    Serial.println(cmd);
  }
}

// ------------------------------------------------------------------ //
// Comandos                                                             //
// ------------------------------------------------------------------ //

void cmd_estop() {
  estop = true;
  enabled = false;
  // Apagar servos
  for (int i = 0; i < NUM_JOINTS; i++) {
    servos[i].detach();
  }
  buzz(3, 100);
  Serial.println("OK ESTOP activado");
}

void cmd_enable() {
  estop = false;
  enabled = true;
  // Reactivar servos
  for (int i = 0; i < NUM_JOINTS; i++) {
    servos[i].attach(SERVO_PINS[i]);
    write_servo(i, current_angles[i]);
  }
  buzz(1, 200);
  Serial.println("OK ENABLE robot habilitado");
}

void cmd_home() {
  if (estop) {
    Serial.println("ERR Robot en parada de emergencia");
    return;
  }
  for (int i = 0; i < NUM_JOINTS; i++) {
    target_angles[i] = HOME_ANGLES[i];
  }
  Serial.println("OK HOME moviendo a posición cero");
}

void cmd_status() {
  Serial.print("INFO Angles: ");
  for (int i = 0; i < NUM_JOINTS; i++) {
    Serial.print(current_angles[i], 2);
    if (i < NUM_JOINTS - 1) Serial.print(",");
  }
  Serial.println();
  Serial.print("INFO Status: ");
  Serial.print(estop ? "ESTOP" : (enabled ? "ENABLED" : "DISABLED"));
  Serial.println();
}

void cmd_joints(String data) {
  if (estop) {
    Serial.println("ERR Robot en parada de emergencia");
    return;
  }
  if (!enabled) {
    Serial.println("ERR Robot deshabilitado");
    return;
  }

  // Parsear "J1.5,2.3,-45.0,..."
  float angles[NUM_JOINTS];
  int idx = 0;
  int start = 0;

  for (int i = 0; i <= data.length() && idx < NUM_JOINTS; i++) {
    if (i == data.length() || data[i] == ',') {
      String token = data.substring(start, i);
      token.trim();
      if (token.length() > 0) {
        angles[idx] = token.toFloat();
        idx++;
      }
      start = i + 1;
    }
  }

  if (idx != NUM_JOINTS) {
    Serial.println("ERR Numero incorrecto de ejes");
    return;
  }

  // Verificar límites
  for (int i = 0; i < NUM_JOINTS; i++) {
    if (angles[i] < JOINT_MIN[i] || angles[i] > JOINT_MAX[i]) {
      Serial.print("ERR J");
      Serial.print(i + 1);
      Serial.print(" fuera de limites: ");
      Serial.println(angles[i]);
      return;
    }
  }

  // Aplicar objetivos
  for (int i = 0; i < NUM_JOINTS; i++) {
    target_angles[i] = angles[i];
  }

  // Confirmar
  Serial.print("OK J");
  for (int i = 0; i < NUM_JOINTS; i++) {
    Serial.print(target_angles[i], 2);
    if (i < NUM_JOINTS - 1) Serial.print(",");
  }
  Serial.println();
}

// ================================================================== //
// HARDWARE                                                            //
// ================================================================== //

void write_servo(int joint, float angle_deg) {
  // Convertir ángulo a microsegundos PWM
  float clamped = constrain(angle_deg, JOINT_MIN[joint], JOINT_MAX[joint]);
  int us = SERVO_CENTER_US + (int)(clamped * SERVO_US_PER_DEG);
  us = constrain(us, 500, 2500);
  servos[joint].writeMicroseconds(us);
}

void go_home() {
  for (int i = 0; i < NUM_JOINTS; i++) {
    target_angles[i] = HOME_ANGLES[i];
  }
}

void buzz(int times, int duration_ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration_ms);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(100);
  }
}

void startup_sequence() {
  // Parpadeo de LED y beep de inicio
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    buzz(1, 80);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
}
