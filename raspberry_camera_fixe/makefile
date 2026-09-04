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
LIBS = -lopencv_core -lopencv_highgui -lopencv_imgproc -lopencv_videoio -lcurl -lgpiod -lpthread

capture.o : capture.cpp capture.h
	$(CC) $(CFLAGS) -c capture.cpp $(PATH_INCLUDE)

mouvement.o : mouvement.cpp mouvement.h capture.h
	$(CC) $(CFLAGS) -c mouvement.cpp $(PATH_INCLUDE)

network.o : network.cpp network.h config.h
	$(CC) $(CFLAGS) -c network.cpp $(PATH_INCLUDE)

gpio.o : gpio.cpp gpio.h config.h
	$(CC) $(CFLAGS) -c gpio.cpp $(PATH_INCLUDE)

main.o : main.cpp capture.h mouvement.h network.h gpio.h config.h
	$(CC) $(CFLAGS) -c main.cpp $(PATH_INCLUDE)

capture : capture.o mouvement.o network.o gpio.o main.o
	$(CC) $(CFLAGS) capture.o mouvement.o network.o gpio.o main.o -o capture $(PATH_INCLUDE) $(PATH_LIBS) $(LIBS)

clean :
	rm -f capture *.o *~
