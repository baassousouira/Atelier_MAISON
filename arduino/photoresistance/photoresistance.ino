#define mayou A0  // composante photoresistor sur la pin A0
#define sara A1

unsigned int value;
unsigned int value2;
 
void setup() {
   // initialise la communication avec le PC
   Serial.begin(9600);

   // initialise les broches
   pinMode(mayou, INPUT);
   pinMode(sara, INPUT);
}
 
void loop() {
   // mesure la tension sur la broche A1
   value = analogRead(mayou);
   //Serial.println("value1");
   Serial.println(value);
   
   value2 = analogRead(sara);
   //Serial.println("value2");
   Serial.println(value2);

   delay(200);
}
