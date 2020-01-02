var gl;
var objectProgram;
var screenProgram;

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var axis = 0;
var theta = [ 0, 0, 0 ];
var paused = 0;
var depthTest = 1;

// event handlers for mouse input (borrowed from "Learning WebGL" lesson 11)
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;

var moonRotationMatrix = mat4();

const startDateTime = Date.now();
const startTimestamp = Math.floor(startDateTime / 1000);

var screenVBO;

function handleMouseDown(event) {
    mouseDown = true;
    lastMouseX = event.clientX;
	lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    mouseDown = false;
}

function handleMouseMove(event) {
    if (!mouseDown) {
      return;
    }

    var newX = event.clientX;
    var newY = event.clientY;
    var deltaX = newX - lastMouseX;
    var newRotationMatrix = rotate(deltaX/10, 0, 1, 0);

    var deltaY = newY - lastMouseY;
    newRotationMatrix = mult(rotate(deltaY/10, 1, 0, 0), newRotationMatrix);

    moonRotationMatrix = mult(newRotationMatrix, moonRotationMatrix);

    lastMouseX = newX
    lastMouseY = newY;
}

// event handlers for button clicks
function rotateX() {
	paused = 0;
    axis = xAxis;
};
function rotateY() {
	paused = 0;
	axis = yAxis;
};
function rotateZ() {
	paused = 0;
	axis = zAxis;
};


// ModelView and Projection matrices
var modelingLoc, viewingLoc, projectionLoc;

var eyePosition   = vec4( 0.0, 0.0, 2.0, 1.0 );
var lightPosition = vec4( 10.0, 10.0, 0.0, 1.0 );

var materialAmbient = vec4( 0.25, 0.25, 0.25, 1.0 );
var materialDiffuse = vec4( 0.8, 0.8, 0.8, 1.0);
var materialSpecular = vec4( 1.0, 1.0, 0.0, 1.0 );
var materialShininess = 30.0;

var quadVertices = [
    // positions   // texCoords
    -1.0,  1.0,  0.0, 1.0,
    -1.0, -1.0,  0.0, 0.0,
     1.0, -1.0,  1.0, 0.0,

    -1.0,  1.0,  0.0, 1.0,
     1.0, -1.0,  1.0, 0.0,
     1.0,  1.0,  1.0, 1.0
];

// frame texture to store
var frameTexture;
var intensityTexture;
var frameBufferObject

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    
    gl = canvas.getContext("webgl2");
    if (!gl) {
            console.error("WebGL 2 not available");
            document.body.innerHTML = "This example requires WebGL 2 which is unavailable on this system."
    }

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    //  Load shaders and initialize attribute buffers
    
    objectProgram = initShaders( gl, "object-vs", "object-fs" );
    gl.useProgram( objectProgram );
    
	// uniform variables in shaders
    modelingLoc   = gl.getUniformLocation(objectProgram, "modelingMatrix"); 
    viewingLoc    = gl.getUniformLocation(objectProgram, "viewingMatrix"); 
    projectionLoc = gl.getUniformLocation(objectProgram, "projectionMatrix"); 

    gl.uniform4fv( gl.getUniformLocation(objectProgram, "eyePosition"), 
       flatten(eyePosition) );
    gl.uniform4fv( gl.getUniformLocation(objectProgram, "lightPosition"), 
       flatten(lightPosition) );
    gl.uniform4fv( gl.getUniformLocation(objectProgram, "materialAmbient"),
       flatten(materialAmbient));
    gl.uniform4fv( gl.getUniformLocation(objectProgram, "materialDiffuse"),
       flatten(materialDiffuse) );
    gl.uniform4fv( gl.getUniformLocation(objectProgram, "materialSpecular"), 
       flatten(materialSpecular) );	       
    gl.uniform1f( gl.getUniformLocation(objectProgram, "shininess"), materialShininess);

    console.log(modelMesh);
    handleLoadedModel(modelMesh);
    console.log(modelMesh);
    
    screenProgram = initShaders( gl, "screen-vs", "screen-fs" );
    gl.useProgram( screenProgram );
    
	vScreenPosition = gl.getAttribLocation( screenProgram, "vPosition" );
	gl.enableVertexAttribArray( vScreenPosition );

	vScreenTexCoord = gl.getAttribLocation( screenProgram, "vTexCoord" );
	gl.enableVertexAttribArray( vScreenTexCoord );
    
    screenWidth = 512
    screenHeight = 512
    
    frameTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                screenWidth, screenHeight, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    intensityTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, intensityTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI,
                screenWidth, screenHeight, 0,
                gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    
    frameBufferObject = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferObject);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameTexture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, intensityTexture, 0);
    gl.drawBuffers([
              gl.COLOR_ATTACHMENT0,
              gl.COLOR_ATTACHMENT1
        ]);

    

    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);     
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, screenWidth, screenHeight);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
            alert("Framebuffer not complete!");
    
    screenVBO = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, screenVBO );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(quadVertices), gl.STATIC_DRAW );
		
    //event listeners for buttons 
    document.getElementById( "xButton" ).onclick = rotateX;
    document.getElementById( "yButton" ).onclick = rotateY;
    document.getElementById( "zButton" ).onclick = rotateZ;
    document.getElementById( "pButton" ).onclick = function() {paused=!paused;};
    document.getElementById( "dButton" ).onclick = function() {depthTest=!depthTest;};
	
	// event handlers for mouse input (borrowed from "Learning WebGL" lesson 11)
	canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;
    
    render();
};

function render() {
    const dateTime = Date.now();
    const timestamp = dateTime / 1000;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferObject);
    gl.clearBufferfv(gl.COLOR, 0, [1.0, 1.0, 1.0, 1.0]);
    gl.clearBufferuiv(gl.COLOR, 1, [0.0, 0.0, 0.0, 0.0]);
    gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1.0, 0);

    
    var modeling = mult(rotate(theta[xAxis], 1, 0, 0),
	                mult(rotate(theta[yAxis], 0, 1, 0),rotate(theta[zAxis], 0, 0, 1)));

	if (paused)	modeling = moonRotationMatrix;
	
	var viewing = lookAt(vec3(eyePosition), [0,0,0], [0,1,0]);

	var projection = perspective(60, 1.0, 0.5, 10.0);

    if (! paused) theta[axis] += 2.0;
	if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
	
    gl.useProgram(objectProgram);
    
    gl.uniformMatrix4fv( viewingLoc,    0, flatten(viewing) );
	gl.uniformMatrix4fv( projectionLoc, 0, flatten(projection) );
    gl.uniform1f( gl.getUniformLocation(objectProgram, "intensityLevel"), document.getElementById("intensityLevel").value);
    
    
    modelMesh.transform = mult(rotate(90.0, 0.0, 0.0, 1.0), mult(translate(-1.0, 1.0, -4.0), mult(scale(0.6, 0.6, 0.6), mult(rotate(90.0, 1.0, 0.0, 0.0), modeling))));
    renderAssimpObject(modelMesh, timestamp - startTimestamp);
	
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, intensityTexture);
    gl.useProgram(screenProgram)
	gl.bindBuffer( gl.ARRAY_BUFFER, screenVBO );
    gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 16, 0 );
    gl.vertexAttribPointer( 1, 2, gl.FLOAT, false, 16, 8 );
    gl.uniform1i( gl.getUniformLocation(screenProgram, "colorSampler"), 0);
    gl.uniform1i( gl.getUniformLocation(screenProgram, "intensitySampler"), 1);
    gl.uniform1f( gl.getUniformLocation(screenProgram, "pixelSize"), document.getElementById( "pixelSize" ).value);
    gl.uniform1i( gl.getUniformLocation(screenProgram, "grid"), document.getElementById( "grid" ).value);
	
    gl.drawArrays( gl.TRIANGLES, 0, 6 );
    
    requestAnimFrame( render );
}
