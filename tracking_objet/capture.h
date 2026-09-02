#ifndef __CAPTURE_H
#define __CAPTURE_H

#include <opencv2/opencv.hpp>
#include <iostream>
#include <stdio.h>

#define CAPTURE_WIDTH 640
#define CAPTURE_HEIGHT 480

using namespace cv;

/* opencv capture primitives */
void open_capture(VideoCapture *);
void capture_frame(VideoCapture *outcap,Mat *frame);

/*Image processing primitives */
void RGBtoBW (Mat *frame3b,Mat *BW);
void detect_red (Mat *frame3b,Mat *BW);
void barycentre_red (Mat *frame3b);

#endif /* __CAPTURE_H*/
