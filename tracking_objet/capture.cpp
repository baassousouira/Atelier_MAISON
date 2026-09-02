#include "./capture.h"


void open_capture(VideoCapture *outcap){
    if(!outcap->isOpened()){  // check if we succeeded
	std::cerr<<"capture marche pas"<<std::endl;
        exit(EXIT_FAILURE);}
    /*  opencv 3.3 : CV_CAP_PROP_FRAME_WIDTH
        opencv 4 : CAP_PROP_FRAME_WIDTH */
   
    outcap->set(CAP_PROP_FRAME_WIDTH,CAPTURE_WIDTH);  //taille de la fenetre
    outcap->set(CAP_PROP_FRAME_HEIGHT,CAPTURE_HEIGHT); //au dela de 320*240
    
}

/* assume that frame is allocated*/
void capture_frame(VideoCapture *outcap,Mat *frame){
    
    if(outcap->read(*frame));
         else exit(EXIT_FAILURE);
}


/* assume frame3b is allocated with size (CapWidth*CapHeight*3) and BW is allocated with size (CapWidth*CapHeight) */

// fonction qui convertit un pixel de couleur en pixel gris (entre noir et blanc -> 0 et 255)
void RGBtoBW (Mat *frame3b,Mat *BW){
	int i,count;
	i = 0;
	for( count=0;count<(CAPTURE_HEIGHT*CAPTURE_WIDTH);count++) {
		BW->data[count] = (frame3b->data[i] + frame3b->data[i+1] + frame3b->data[i+2])/3;
		i=i+3;
	}
}

    
/* assume frame3b is allocated with size (CapWidth*CapHeight*3) and redact is allocated with size (CapWidth*CapHeight) */
void detect_red (Mat *frame3b,Mat *redact){
    int i,count;
    i = 0;
    
    for( count=0;count<(CAPTURE_HEIGHT*CAPTURE_WIDTH);count++) {
        //on accède au champs RGB de chaque pixel
        unsigned char B = frame3b->data[i];
        unsigned char G = frame3b->data[i+1];
        unsigned char R = frame3b->data[i+2];
        
        // si rouge
        if (R > 150 && G < 80 && B < 80 && R>G +60 && R>B + 60)
            redact->data [count] =255;
        else 
            redact->data [count] = 0; // pas rouge
            i=i+3;
    }
}

// fonction fait appraitre un pointeur en forme * (trop longue mais pas réussi à l'alléger)
void mark_barycentre(Mat *redact, double bx, double by){
    int x = int(bx);
    int y = int(by);
    
    if (x<1 || x >= CAPTURE_WIDTH-1 || y<1 || y >= CAPTURE_HEIGHT-1)return;
    
    redact->data[y * CAPTURE_WIDTH + x] = 125;
    
    redact->data[y * CAPTURE_WIDTH + (x+1)] = 125;
    redact->data[y * CAPTURE_WIDTH + (x-1)] = 125;
    redact->data[(y+1) * CAPTURE_WIDTH + x] = 125;
    redact->data[(y-1) * CAPTURE_WIDTH + x] = 125;
    
    redact->data[y * CAPTURE_WIDTH + (x+2)] = 125;
    redact->data[y * CAPTURE_WIDTH + (x-2)] = 125;
    redact->data[(y+2) * CAPTURE_WIDTH + x] = 125;
    redact->data[(y-2) * CAPTURE_WIDTH + x] = 125;
    
    redact->data[(y+1) * CAPTURE_WIDTH + (x+1)] = 125;
    redact->data[(y+1) * CAPTURE_WIDTH + (x-1)] = 125;
    redact->data[(y-1) * CAPTURE_WIDTH + (x+1)] = 125;
    redact->data[(y-1) * CAPTURE_WIDTH + (x-1)] = 125;
    redact->data[(y+1) * CAPTURE_WIDTH + (x+1)] = 125;
    redact->data[(y-1) * CAPTURE_WIDTH + (x+1)] = 125;
    redact->data[(y+1) * CAPTURE_WIDTH + (x-1)] = 125;
    redact->data[(y-1) * CAPTURE_WIDTH + (x-1)] = 125;
    
    redact->data[(y+2) * CAPTURE_WIDTH + (x+2)] = 125;
    redact->data[(y+2) * CAPTURE_WIDTH + (x-2)] = 125;
    redact->data[(y-2) * CAPTURE_WIDTH + (x+2)] = 125;
    redact->data[(y-2) * CAPTURE_WIDTH + (x-2)] = 125;
    redact->data[(y+2) * CAPTURE_WIDTH + (x+2)] = 125;
    redact->data[(y-2) * CAPTURE_WIDTH + (x+2)] = 125;
    redact->data[(y+2) * CAPTURE_WIDTH + (x-2)] = 125;
    redact->data[(y-2) * CAPTURE_WIDTH + (x-2)] = 125;
}

// fonction calcul du barycentre
void barycentre_red(Mat*frame3b){
    long sumX=0;
    long sumY=0;
    long count=0;
    
    for(int y = 0; y<CAPTURE_HEIGHT; y++){
        for(int x = 0; x< CAPTURE_WIDTH; x++){
            int pos = y * CAPTURE_WIDTH + x;
            if(frame3b->data[pos] == 255){
                sumX += x;
                sumY += y;
                count++;
            }  
        }
    }
    
    if(count>0){
        double bx  = (double)sumX / count;
        double by  = (double)sumY/count;
        mark_barycentre(frame3b, bx, by);
    }
}
