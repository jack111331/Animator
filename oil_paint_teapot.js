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

var screenVBO;
var vPosition, vColor, vNormal;
var vScreenPosition, vScreenTexCoord;

var moonRotationMatrix = mat4();

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

// --------------------------------
// Define the grid as an object.
// --------------------------------
function grid()
{
	var N = 20;
	var step = 2.0/N;
	var x, z;
	var i, j;

    var coords = [];
    var normals = [];
    var colors = [];
	var texCoords = [];
    var indices = [];
    var wave;
	
	function meshPoint(x, y, z) {
		coords.push(vec3(x, y, z));
		normals.push(vec3(0.0, 1.0, 0.0));
        wave = 0.5+0.5*Math.cos((x+z)*Math.PI*5.0);
		colors.push(vec3(wave, wave, 0.0));
	}
	
    function addIndices(x, z) {
		indices.push(x+z*(N+1));
	}

		
	// Set up the vertices and attributes;
	// (N+1) * (N+1) vertices are produced.
	for (j=0,z=-1.0; j<=N; j++, z+=step) {
		for (i=0, x=-1.0; i<=N; i++, x+=step) {
			meshPoint(x, 0.0, z);
		}			
	}
	
	// Set up the indices;
	// N*N*2 triangles are produced.
	for (j=0; j<N; j++) {
		for (i=0; i<N; i++) {
			addIndices(i, j);
			addIndices(i+1, j);
			addIndices(i, j+1);
			addIndices(i, j+1);
			addIndices(i+1, j);
			addIndices(i+1, j+1);			
		}			
	}

   return {
      vertexPositions: new Float32Array(flatten(coords)),
      vertexNormals: new Float32Array(flatten(normals)),
      vertexColors: new Float32Array(flatten(colors)),
      vertexTextureCoords: new Float32Array(flatten(texCoords)),
      indices: new Uint16Array(indices)
   }

}

function setColor(obj, R, G, B)
{
    for (i=0; i < obj.vertexColors.length; i+=3) {
        obj.vertexColors[i]   = R;
        obj.vertexColors[i+1] = G;
        obj.vertexColors[i+2] = B;
    }
}

function unitize(obj)
{
    var vertices = obj.vertexPositions;
	var maxCorner = vertices[0];
	var minCorner = vertices[0];
	var center = vertices[0];
 
	for (i = 1; i < vertices.length; i++) { 
		maxCorner = Math.max(vertices[i], maxCorner);
		minCorner = Math.min(vertices[i], minCorner);
	}
	for (j=0; j<3; j++) {
		center = (maxCorner+minCorner)/2.0;
	}
		
	for (i = 0; i < vertices.length; i++) { 
		vertices[i] = (vertices[i] - center) * 2.0 / (maxCorner - minCorner);
	}		
}

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

//var testObject = new cube();
//var testObject = new ring();
//var testObject = new uvSphere();
var testObject = new uvTorus();
//var testObject = new uvCylinder();
//var testObject = new uvCone();
unitize(teapotModel); // Make teapot unit sized
var floor = new grid();

function renderObject( obj )
{
	gl.bindBuffer( gl.ARRAY_BUFFER, obj.vertexBuffer );
    gl.vertexAttribPointer( vPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.vertexAttribPointer( vColor, 3, gl.FLOAT, false, 0, 4 * obj.vertexPositions.length );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 4 * (obj.vertexPositions.length + obj.vertexColors.length) );
	
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer );
	
	gl.uniformMatrix4fv( modelingLoc,   0, flatten(obj.transform) );
	
    gl.drawElements( gl.TRIANGLES, obj.indices.length, gl.UNSIGNED_SHORT, 0 );
}

function BufferData(obj) {
    vertexData = new Float32Array(obj.vertexPositions.length + obj.vertexColors.length + obj.vertexNormals.length)
    vertexData.set(flatten(obj.vertexPositions))
    vertexData.set(flatten(obj.vertexColors), obj.vertexPositions.length)
    vertexData.set(flatten(obj.vertexNormals), obj.vertexPositions.length + obj.vertexColors.length)
    
	obj.vertexBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, obj.vertexBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW );

	obj.indexBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer );
	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, obj.indices, gl.STATIC_DRAW );

}

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
    if (!gl.getExtension("EXT_color_buffer_float")) {
            console.error("FLOAT color buffer not available");
            document.body.innerHTML = "This example requires EXT_color_buffer_float which is unavailable on this system."
    }
    
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
    
	vPosition = gl.getAttribLocation( objectProgram, "vPosition" );
	gl.enableVertexAttribArray( vPosition );

	vColor = gl.getAttribLocation( objectProgram, "vColor" );
	gl.enableVertexAttribArray( vColor );

	vNormal = gl.getAttribLocation( objectProgram, "vNormal" );
	gl.enableVertexAttribArray( vNormal );

    
    screenProgram = initShaders( gl, "screen-vs", "screen-fs" );
    gl.useProgram( screenProgram );
    
	vScreenPosition = gl.getAttribLocation( screenProgram, "vPosition" );
	gl.enableVertexAttribArray( vScreenPosition );

	vScreenTexCoord = gl.getAttribLocation( screenProgram, "vTexCoord" );
	gl.enableVertexAttribArray( vScreenTexCoord );


	
    // Add vertexColors member to the objects
    testObject.vertexColors = new Float32Array(testObject.vertexNormals);
    setColor( testObject, 1.0, 0.0, 0.0);
    teapotModel.vertexColors = new Float32Array(teapotModel.vertexNormals);
    setColor( teapotModel, 0.0, 1.0, 0.0);
    
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
 	
	BufferData(testObject);
	BufferData(teapotModel);
	BufferData(floor);


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


var evans = 300.0;
var damom = 4;
var hemsworth = 5.0;


function render() 
{	

	gl.uniform1f( gl.getUniformLocation(screenProgram, "evans"), evans);
	
	damom = document.getElementById( "damom" ).value;
	gl.uniform1i( gl.getUniformLocation(screenProgram, "damom"), damom);
	
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
	hemsworth = document.getElementById( "hemsworth" ).value;
	gl.uniform1f( gl.getUniformLocation(objectProgram, "hemsworth"), hemsworth);

	// Set the modeing transformation so that the object is shrinked and moved to the left.
    testObject.transform = mult( translate(-0.5, 0, 0), mult(scale(0.5, 0.5, 0.5), modeling) );
    renderObject( testObject );
    
	// Set the modeing transformation so that the teapot is shrinked and moved to the right.
    teapotModel.transform = mult( translate(0.5, 0, 0), mult(scale(0.5, 0.5, 0.5), modeling) );
    renderObject( teapotModel );
	
	// Set the modeing transformation so that the floor is lower.
	floor.transform = translate(0, -0.5, 0);
	renderObject( floor );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, intensityTexture);
    gl.useProgram(screenProgram)
	gl.bindBuffer( gl.ARRAY_BUFFER, screenVBO );
    gl.vertexAttribPointer( vScreenPosition, 2, gl.FLOAT, false, 16, 0 );
    gl.vertexAttribPointer( vScreenTexCoord, 2, gl.FLOAT, false, 16, 8 );
    gl.uniform1i( gl.getUniformLocation(screenProgram, "colorSampler"), 0);
    gl.uniform1i( gl.getUniformLocation(screenProgram, "intensitySampler"), 1);
	
    gl.drawArrays( gl.TRIANGLES, 0, 6 );
    
    requestAnimFrame( render );
}
