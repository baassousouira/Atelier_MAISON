#include "./capture.h"

// fichiers capture & primitves d'image

//Fonction qui inittialse la capture vidéo à partir de l'objet VideoCapture
void open_capture(VideoCapture *outcap){
    //Ici on vérifie que la caméra s'ouvre correcteur sinon ... 
    if(!outcap->isOpened()){  // check if we succeeded
	std::cerr<<"capture marche pas"<<std::endl;
        exit(EXIT_FAILURE);}
/* opencv 3.3 : CV_CAP_PROP_FRAME_WIDTH
   opencv 4 : CAP_PROP_FRAME_WIDTH */
   
    outcap->set(CAP_PROP_FRAME_WIDTH,CAPTURE_WIDTH);  //taille de la fenetre
    outcap->set(CAP_PROP_FRAME_HEIGHT,CAPTURE_HEIGHT); //au dela de 320*240
    
}

/* Fonction qui lit une image de la caméra et la stocke dans "frame" */
void capture_frame(VideoCapture *outcap, cv::Mat *frame){
    if(!outcap->read(*frame)){
        std::cerr<<"Erreur lecture frame"<<std::endl;
        exit(EXIT_FAILURE);
    }
}



/* assume frame3b is allocated with size (CapWidth*CapHeight*3) and BW is allocated with size (CapWidth*CapHeight) */

void RGBtoBW (Mat *frame3b,Mat *BW){
    
  int i,count;
  i = 0;
    for( count=0;count<(CAPTURE_HEIGHT*CAPTURE_WIDTH);count++) {
           BW->data[count] = (frame3b->data[i] + frame3b->data[i+1] + frame3b->data[i+2])/3;
       
            i=i+3;
    }
}

//--------------------- POUR DÉTECTER LE ROUGE  -----------------------------------------------
//
//// //////////////////////////////////////////////////////////////////////////////////////// //
void mark_barycentre(Mat *redact, double bx, double by){
    int x = int(bx);
    int y = int(by);

    // Vérification des bornes
    if (x < 2 || x >= CAPTURE_WIDTH-2 || y < 2 || y >= CAPTURE_HEIGHT-2) return;

    // Dessiner une croix de taille 5x5
    for(int dy=-2; dy<=2; dy++){
        redact->data[(y+dy)*CAPTURE_WIDTH + x] = 125; // ligne verticale
    }
    for(int dx=-2; dx<=2; dx++){
        redact->data[y*CAPTURE_WIDTH + (x+dx)] = 125; // ligne horizontale
    }
}

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
    
/* assume frame3b is allocated with size (CapWidth*CapHeight*3) and redact is allocated with size (CapWidth*CapHeight) */

void detect_red (Mat *frame3b,Mat *redact){
    
    int i,count;
    i = 0;
    
    for( count=0;count<(CAPTURE_HEIGHT*CAPTURE_WIDTH);count++) {
        
    //on accède au champs RGB de chaque pxel
    //frame3b->data[i+2]
    unsigned char B = frame3b->data[i];
    //frame3b->data[i]
    unsigned char G = frame3b->data[i+1];
    //frame3b->data[i+1]
    unsigned char R = frame3b->data[i+2];
    
    
    //rouge
    if (R > 150 && G < 80 && B < 80 && R>G +60 && R>B + 60)
        redact->data [count] =255;
    else 
        redact->data [count] = 0; // pas rouge
        i=i+3;
    }
}
//// ///////////////////////////////////////////////////////////////////////////  ///
//------------------------------FIN DETECTION ROUG -----------------------------------
