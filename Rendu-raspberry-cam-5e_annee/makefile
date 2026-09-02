all : capture

CC = g++
CFLAGS = -Wall

#PATH_INCLUDE = -I/usr/include/opencv4  #for linux
#PATH_INCLUDE = -I/usr/local/include   #for mac
PATH_INCLUDE = -I/usr/include/opencv4   #for raspi4

#PATH_LIBS = -L/usr/local/lib                  #for mac
#PATH_LIBS = -L/usr/lib/x86_64-linux-gnu/      #for linux
PATH_LIBS = -L/usr/lib/aarch64-linux-gnu/      #for raspi4

LIBS = -lopencv_core -lopencv_highgui -lopencv_imgproc -lopencv_videoio

capture.o : capture.cpp capture.h
	$(CC) $(CFLAGS) -c capture.cpp $(PATH_INCLUDE)

mouvement.o : mouvement.cpp mouvement.h capture.h
	$(CC) $(CFLAGS) -c mouvement.cpp $(PATH_INCLUDE)

main.o : main.cpp capture.h mouvement.h
	$(CC) $(CFLAGS) -c main.cpp $(PATH_INCLUDE)

capture : capture.o mouvement.o main.o
	$(CC) $(CFLAGS) capture.o mouvement.o main.o -o capture $(PATH_INCLUDE) $(PATH_LIBS) $(LIBS)
	
clean :
	rm -f capture *.o *~
