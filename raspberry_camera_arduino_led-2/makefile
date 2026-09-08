# Makefile du programme Raspberry n°2 (caméra fixe + détection de mouvement)
# Basé sur votre makefile d'origine, complété avec les nouveaux modules
# network.cpp (communication serveur) et gpio.cpp (pilotage LED).

all : capture

CC = g++
CFLAGS = -Wall
# Pour activer les fenêtres de debug (utile sur un PC avec écran) :
#   make CFLAGS="-Wall -DDEBUG_UI"

#PATH_INCLUDE = -I/usr/include/opencv4  #for linux
#PATH_INCLUDE = -I/usr/local/include   #for mac
PATH_INCLUDE = -I/usr/include/opencv4   #for raspi4

#PATH_LIBS = -L/usr/local/lib                  #for mac
#PATH_LIBS = -L/usr/lib/x86_64-linux-gnu/      #for linux
PATH_LIBS = -L/usr/lib/aarch64-linux-gnu/      #for raspi4

# Ajout de -lcurl (requêtes HTTP vers le serveur) et -lgpiod (pilotage GPIO/LED)
# -lpthread est nécessaire car network.cpp/gpio.cpp utilisent std::this_thread
LIBS = -lopencv_core -lopencv_highgui -lopencv_imgproc -lopencv_videoio -lopencv_imgcodecs -lcurl -lgpiod -lpthread

capture.o : capture.cpp capture.h
	$(CC) $(CFLAGS) -c capture.cpp $(PATH_INCLUDE)

mouvement.o : mouvement.cpp mouvement.h capture.h
	$(CC) $(CFLAGS) -c mouvement.cpp $(PATH_INCLUDE)

network.o : network.cpp network.h config.h
	$(CC) $(CFLAGS) -c network.cpp $(PATH_INCLUDE)

gpio.o : gpio.cpp gpio.h config.h
	$(CC) $(CFLAGS) -c gpio.cpp $(PATH_INCLUDE)

arduino.o : arduino.cpp arduino.h
	$(CC) $(CFLAGS) -c arduino.cpp $(PATH_INCLUDE)

shared_state.o : shared_state.cpp shared_state.h
	$(CC) $(CFLAGS) -c shared_state.cpp $(PATH_INCLUDE)

# httplib.h est un gros fichier (bibliothèque HTTP "header-only") : cette
# compilation est plus longue que les autres, c'est normal.
api_locale.o : api_locale.cpp api_locale.h shared_state.h httplib.h
	$(CC) $(CFLAGS) -c api_locale.cpp $(PATH_INCLUDE)

main.o : main.cpp capture.h mouvement.h network.h gpio.h arduino.h shared_state.h api_locale.h config.h
	$(CC) $(CFLAGS) -c main.cpp $(PATH_INCLUDE)

capture : capture.o mouvement.o network.o gpio.o arduino.o shared_state.o api_locale.o main.o
	$(CC) $(CFLAGS) capture.o mouvement.o network.o gpio.o arduino.o shared_state.o api_locale.o main.o -o capture $(PATH_INCLUDE) $(PATH_LIBS) $(LIBS)

clean :
	rm -f capture *.o *~
