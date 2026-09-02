
/*


Auteur: anonyme

Interface: arduino

Nom du projet: Tracer le signal de la photorésistance

Description: No description

Toolbox: vittascience

Mode: blocks

Blocks: <xml xmlns="https://developers.google.com/blockly/xml"><block type="on_start" id="G[=T#8yqB70`NFgYq}GP" deletable="false" x="62" y="13"></block><block type="forever" id="o[WN]+eeF.OUxGch67@8" deletable="false" x="62" y="162"><statement name="DO"><block type="communication_graphSerialWrite" id="^wu^+cOgXu:9`/2c,HKr"><mutation items="1"></mutation><value name="ADD0"><block type="communication_graphSerialWrite_datasFormat" id="+:FeBZ4@B,EVdLq@.j:1"><field name="NAME"></field><value name="DATA"><block type="io_readAnalogPin" id="E/In1xcf4$ZUI_k?8Ki?"><field name="PIN">A0</field></block></value></block></value><next><block type="io_wait" id="%LE==?Juf+jY9%cv!W:C"><field name="UNIT">SECOND</field><value name="TIME"><shadow type="math_number" id="/rRKYG4:+$%+/rc*tjd_"><field name="NUM">100</field></shadow></value></block></next></block></statement></block></xml>

Projet généré par Vittascience.

Ce fichier contient le code textuel ainsi que le code blocs. Il peut être importé de nouveau

sur l'interface http://vittascience.com/arduino


*/

void serial_setupConnection(int baudrate) {
  Serial.begin(baudrate);
  while (!Serial) {
    Serial.println("En attente de l'ouverture du port série...");
    delay(1000);
  }
  Serial.println("Port série activé. Baudrate: " + String(baudrate));
  delay(50);
}


void setup() {
  serial_setupConnection(9600);
  pinMode(A0, INPUT);
}

void loop() {
  Serial.print("@Graph:");
  Serial.print(""":");
  Serial.print(String(analogRead(A0)));
  Serial.print("|");
  Serial.print("\n");
  delay(50);
  delay(1000*100);
}