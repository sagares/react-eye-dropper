import React, { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { MagnifierProps } from "../types";

interface CanvasContext extends CanvasRenderingContext2D {
  mozImageSmoothingEnabled: boolean;
  msImageSmoothingEnabled: boolean;
  webkitImageSmoothingEnabled: boolean;
};

const Magnifier = (props: MagnifierProps) => {
  const magnifierRef = useRef<HTMLDivElement>(document.createElement("div"));
  const magnifierContentRef = useRef<HTMLDivElement>(document.createElement("div"));

  const { active, magnifierSize: size, setColorCallback, zoom, pixelateValue } = props;

  const setPosition = (element: HTMLElement, top: number, left: number) => {
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  const setDimensions = (element: HTMLElement, width: number, height: number) => {
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  };

  const setupMagnifier = () => {
    const magnifierContent = magnifierContentRef.current;
    magnifierContent.style.transform = `scale(${zoom})`;
  }

  const prepareContent = () => {
    const magnifier = magnifierRef.current;
    const magnifierContent = magnifierContentRef.current;

    if(!magnifier && !magnifierContent) {
      return;
    }

    magnifierContent.innerHTML = '';
    const { ownerDocument } = magnifierRef.current;
    const bodyOriginal = ownerDocument.body;
    const color = bodyOriginal.style.backgroundColor;

    if (color) {
        magnifier.style.backgroundColor =  color;
    }

    html2canvas(bodyOriginal).then(canvas => {
      const width = ownerDocument.body.clientWidth;
      const height = ownerDocument.body.clientHeight;
      setDimensions(magnifierContent, width, height);

      magnifierContent.appendChild(canvas);
      const image = new Image();
      image.src = canvas.toDataURL();

      image.onload = pixelate.bind(null, image, canvas);
    });
  }

  const pixelate = (image: any, canvas: any) => {
    canvas.height = image.height;
    canvas.width = image.width;
    const ctx = canvas.getContext('2d') as CanvasContext;

    const fw = (image.width / pixelateValue) | 0;
    const fh = (image.height / pixelateValue) | 0;

    if(ctx && image) {
      ctx.imageSmoothingEnabled =
      ctx.mozImageSmoothingEnabled =
      ctx.msImageSmoothingEnabled =
      ctx.webkitImageSmoothingEnabled = false;

      ctx.drawImage(image, 0, 0, fw, fh);

      ctx.drawImage(canvas, 0, 0, fw, fh, 0, 0, image.width, image.height);
    }
  }

  const syncViewport = () => {
    if(magnifierRef.current) {
      const x1 = magnifierRef.current.offsetLeft + size/4 + zoom*4;
      const y1 = magnifierRef.current.offsetTop + size/4 + zoom*4;

      const x2 = window.pageXOffset;
      const y2 = window.pageYOffset;
      const left1 = -x1 * zoom - x2 * zoom;
      const top1 = -y1 * zoom - y2 * zoom;
      setPosition(magnifierContentRef.current, top1, left1);
    }
  }

  const syncScrollBars = (e: any) => {
    if(!magnifierRef.current) {
      return;
    }
    
    const ownerDocument = magnifierRef.current.ownerDocument;
    if (e && e.target) {
      syncScroll(e.target);
    } else {
      let scrolled = [];
      let elements = ownerDocument && ownerDocument.querySelectorAll('div');
      for(let i = 0; i < elements.length; i++) {
        if (elements[i].scrollTop > 0) {
          scrolled.push(elements[i]);
        }
      }
      for(let i = 0; i < scrolled.length; i++) {
        if (!isDescendant(magnifierRef.current, scrolled[i])) {
          syncScroll(scrolled[i]);
        }
      }
    }
      
  }

  const syncScroll = (ctrl: any) => {
    const selectors = [];
    if (ctrl.getAttribute) {
      if (ctrl.getAttribute('id')) {
        selectors.push('#' + ctrl.getAttribute('id'));
      }
      if (ctrl.className) {
        selectors.push('.' + ctrl.className.split(' ').join('.'));
      }
      for(let i = 0; i < selectors.length; i++) {
        let t = ctrl.ownerDocument.body.querySelectorAll(selectors[i]);
        if (t.length === 1) {
          t[0].scrollTop  = ctrl.scrollTop;
          t[0].scrollLeft = ctrl.scrollLeft;
          return true;
        }
      }
    } else if (ctrl === document) {
      syncViewport();
    }
    return false;
  }

  const isDescendant = (parent: any, child: any) => {
    let node = child;
    while (node != null) {
      if (node === parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  function syncContent() {
    if (active) {
      prepareContent();
      syncViewport();
      syncScrollBars({});
    }
  }

  const moveHandler = (e: any) => {
    let dragObject = magnifierRef.current;

    if (dragObject !== null) {
      const rect = dragObject.getBoundingClientRect();
      const pageX = e.clientX;
      const pageY = e.clientY;
      const left = pageX - rect.width/2;
      const top = pageY - rect.height/2;

      setPosition(dragObject, top, left);
      syncViewport();
    }
  };

  const makeDraggable = () => {
    const dragHandler = magnifierRef.current as HTMLElement;

    setPosition(dragHandler, -1 * size, -1 * size);
    window.addEventListener("mousemove", function (e) {
      moveHandler(e);
    });

    window.addEventListener('resize', syncContent, false);
    magnifierRef.current.ownerDocument.addEventListener('scroll', syncScrollBars, true);
  };

  useEffect(() => {
      if(active) {
        makeDraggable();
        setupMagnifier();
        prepareContent();
        syncViewport();
        syncScrollBars({});
      }
  }, [active]);

  const getColorFromCanvas = (e:any) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const magnifier = magnifierRef.current;
    const canvas = magnifier.querySelector("canvas");
    const context = canvas?.getContext('2d');

    const x = clientX*2 - zoom + window.scrollX/2;
    const y = (clientY + window.scrollY)*2 - zoom;
    const pixels = context && context.getImageData(x, y, 1, 1).data;
    const hex = pixels && "#" + ("000000" + rgbToHex(pixels[0], pixels[1], pixels[2])).slice(-6);
    
    setColorCallback && setColorCallback(hex);
  }

  const rgbToHex = (r:any, g:any, b:any) => {
    if (r > 255 || g > 255 || b > 255)
        throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
  }

  return active ? (
    <div
      ref={magnifierRef}
      className="magnifier"
      style={{
        display: "block",
        position: "fixed",
        overflow: "hidden",
        backgroundColor: "#fff",
        border: "2px solid #555",
        borderRadius: "50%",
        zIndex: 10000,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <div
        ref={magnifierContentRef}
        className="magnifier-content"
        style={{
          top: "0px",
          left: "0px",
          marginLeft: "0px",
          marginTop: "0px",
          overflow: "visible",
          position: "absolute",
          display: "block",
          transformOrigin: "left top",
          userSelect: "none",
          paddingTop: "0px",
        }}
      ></div>
      <div
      onClick={getColorFromCanvas}
        className="magnifier-glass"
        style={{
          backgroundSize: `${2*pixelateValue + 3}px ${2*pixelateValue + 3}px`,
          backgroundPosition: "center",
          position: "absolute",
          top: "0px",
          left: "0px",
          width: "100%",
          height: "100%",
          opacity: 1,
          cursor: "none",
          display: "grid",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 12 12" 
          width={2*pixelateValue + 3} 
          height={2*pixelateValue + 3}
          style={{
            border: "2px solid #fff",
            position: "relative",
            margin: "0 auto",
            boxShadow: "inset 0 0 0 1px #000000"
          }}>
          </svg>
      </div>
    </div>
  ) : (
    <div></div>
  );
};

export default Magnifier;