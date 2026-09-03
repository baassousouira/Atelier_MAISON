const int capteur = A0;     // photoresistance
const int bouton = 4;       // bouton

void setup() {
  pinMode(bouton, INPUT);   // Bouton en entrée
  Serial.begin(9600);       // Pour afficher l'alerte
}

void loop() {
  int luminosite = analogRead(capteur);
  float pourcentage = (luminosite / 1023.0) * 100.0;
  
  int etatBouton = digitalRead(bouton);

  Serial.print("{\"luminosite\":");
  Serial.print(pourcentage);
  Serial.print(",\"bouton\":");
  Serial.print(etatBouton);
  Serial.println("}");

  delay(100);

}
