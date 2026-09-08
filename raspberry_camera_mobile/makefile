# Makefile du Raspberry mobile (caméra + servo)
# Pas de gpiod ici : ce Raspberry n'a pas de LED câblée en direct.

all : capture

CC = g++
CFLAGS = -Wall

PATH_INCLUDE = -I/usr/include/opencv4   #for raspi4
PATH_LIBS = -L/usr/lib/aarch64-linux-gnu/      #for raspi4

LIBS = -lopencv_core -lopencv_highgui -lopencv_imgproc -lopencv_videoio -lopencv_imgcodecs -lcurl -lpthread

capture.o : capture.cpp capture.h
	$(CC) $(CFLAGS) -c capture.cpp $(PATH_INCLUDE)

network.o : network.cpp network.h config.h
	$(CC) $(CFLAGS) -c network.cpp $(PATH_INCLUDE)

shared_state.o : shared_state.cpp shared_state.h
	$(CC) $(CFLAGS) -c shared_state.cpp $(PATH_INCLUDE)

# httplib.h est un gros fichier (bibliothèque HTTP "header-only") : cette
# compilation est plus longue que les autres, c'est normal.
api_locale.o : api_locale.cpp api_locale.h shared_state.h httplib.h
	$(CC) $(CFLAGS) -c api_locale.cpp $(PATH_INCLUDE)

main.o : main.cpp capture.h network.h shared_state.h api_locale.h config.h
	$(CC) $(CFLAGS) -c main.cpp $(PATH_INCLUDE)

capture : capture.o network.o shared_state.o api_locale.o main.o
	$(CC) $(CFLAGS) capture.o network.o shared_state.o api_locale.o main.o -o capture $(PATH_INCLUDE) $(PATH_LIBS) $(LIBS)

clean :
	rm -f capture *.o *~
