#include <Servo.h>  // on inclut la bibliothèque pour piloter un servomoteur

Servo monServo;     // on crée l'objet monServo

void setup()
{
    monServo.attach(9);   // on définit le Pin utilisé par le servomoteur
    pinMode(8,OUTPUT);   // la Pin13 est mise en mode OUTPUT
}

void loop()
{
    monServo.write(0);      // on dit à l'objet de mettre le servo à 0°
    diode13();              // appel de la fonction diode13 qui est définie plus bas
    monServo.write(180);    // on dit à l'objet de mettre le servo à 180°
    diode13();              // appel de la fonction diode13
}

void diode13()  //on va faire clignoter 15 fois la diode 13
{
    for (int t=0;t<15;t++){
        digitalWrite(8,HIGH);
        delay(100);
        digitalWrite(8,LOW);
        delay(100);
    }
}
