function configureTexture( image ) {
    var texture = gl.createTexture();
    gl.bindTexture( gl.TEXTURE_2D, texture );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, 
         gl.RGB, gl.UNSIGNED_BYTE, image );
    gl.generateMipmap( gl.TEXTURE_2D );
    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, 
                      gl.NEAREST_MIPMAP_LINEAR );
    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
    
    /** Dummy value.
     *
     *  No texture, but the value to be used as 'texture semantic'
     *  (#aiMaterialProperty::mSemantic) for all material properties
     *  *not* related to textures.
     */
//     aiTextureType_NONE = 0,

    /** LEGACY API MATERIALS 
     * Legacy refers to materials which 
     * Were originally implemented in the specifications around 2000.
     * These must never be removed, as most engines support them.
     */

    /** The texture is combined with the result of the diffuse
     *  lighting equation.
     */
//     aiTextureType_DIFFUSE = 1,

    /** The texture is combined with the result of the specular
     *  lighting equation.
     */
//     aiTextureType_SPECULAR = 2,

    /** The texture is combined with the result of the ambient
     *  lighting equation.
     */
//     aiTextureType_AMBIENT = 3,

    /** The texture is added to the result of the lighting
     *  calculation. It isn't influenced by incoming light.
     */
//     aiTextureType_EMISSIVE = 4,

    /** The texture is a height map.
     *
     *  By convention, higher gray-scale values stand for
     *  higher elevations from the base height.
     */
//     aiTextureType_HEIGHT = 5,

    /** The texture is a (tangent space) normal-map.
     *
     *  Again, there are several conventions for tangent-space
     *  normal maps. Assimp does (intentionally) not
     *  distinguish here.
     */
//     aiTextureType_NORMALS = 6,
    gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
    return texture;
}
function handleLoadedModel(object) {
    // Deal with meshes
    var meshesCount = object.meshes.length;
    object.vbo = new Array(meshesCount);
    object.ebo = new Array(meshesCount);
    for(var i = 0;i < meshesCount;i++) {
        // extract bone
        var mesh = object.meshes[i];
        var bonesCount = mesh.bones.length;
        mesh.boneIndexDict = new Map();
        mesh.boneOffsetMatrixDict = new Map();
        var bonesIndexPerVertices = new Array(mesh.vertices.length);
        var bonesWeightPerVertices = new Array(mesh.vertices.length);
        var currentBone = new Array(mesh.vertices.length);
        for(var j = 0;j < mesh.vertices.length;j++) {
            bonesIndexPerVertices[j] = new Array(4);
            bonesWeightPerVertices[j] = new Array(4);
            for(var k = 0;k < 4;k++) {
                bonesIndexPerVertices[j][k] = 0;
                bonesWeightPerVertices[j][k] = 0.0;
            }
            currentBone[j] = 0;
        }
        for(var j = 0;j < bonesCount;j++) {
            var bone = mesh.bones[j];
            if(mesh.boneIndexDict.has(bone.name) == false) {
                mesh.boneIndexDict.set(bone.name, mesh.boneIndexDict.size);
            }
            var boneIndex = mesh.boneIndexDict.get(bone.name);
            mesh.boneOffsetMatrixDict.set(boneIndex, bone.offsetmatrix);
            for(var k = 0;k < bone.weights.length;k++) {
                // bone.weights[k][0] is vertice index
                // bone.weights[k][1] is vertice weight in this bone 
                // [currentBone[bone.weights[k][0]]++] is this vertices has accumulate to one of [0, 3]'s bone
                var mappedIndex = bone.weights[k][0];
                var mappedIndexWeight = bone.weights[k][1];
                bonesIndexPerVertices[mappedIndex][currentBone[mappedIndex]] = boneIndex;
                bonesWeightPerVertices[mappedIndex][currentBone[mappedIndex]++] = mappedIndexWeight;
            }
        }
        mesh.boneWeight = flatten(bonesWeightPerVertices);
        mesh.boneIndex = new Uint16Array(bonesIndexPerVertices.flat());
        mesh.faces = new Uint16Array(mesh.faces.flat());
        // pass data to gpu
        
        object.vbo[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vbo[i]);
        gl.bufferData(gl.ARRAY_BUFFER, 4 * (mesh.vertices.length + mesh.normals.length + mesh.texturecoords.length +  mesh.boneWeight.length) + 2 * (mesh.boneIndex.length), gl.STATIC_DRAW);

        var destOffset = 0;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.vertices));
        destOffset += 4 * mesh.vertices.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.normals));
        destOffset += 4 * mesh.normals.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.texturecoords));
        destOffset += 4 * mesh.texturecoords.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, mesh.boneWeight);
        destOffset += 4 * mesh.boneWeight.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, mesh.boneIndex);

        object.ebo[i] = gl.createBuffer();
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo[i] );
        gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, mesh.faces, gl.STATIC_DRAW );
    }
    // deal with materials
    object.textures = new Array()
}
function renderAssimpObject(object)
{
    for(var i = 0;i < object.meshes.length;i++) {
        var mesh = object.meshes[i];
        gl.bindBuffer( gl.ARRAY_BUFFER, object.vbo[i] );
        
        var destOffset = 0;
        gl.vertexAttribPointer( 0, 3, gl.FLOAT, false, 0, destOffset );
        destOffset += 4 * mesh.vertices.length;
        gl.vertexAttribPointer( 1, 3, gl.FLOAT, false, 0, destOffset );
        destOffset += 4 * mesh.normals.length;
        gl.vertexAttribPointer( 2, 2, gl.FLOAT, false, 0, destOffset );
        destOffset += 4 * mesh.texturecoords.length;
        gl.vertexAttribPointer( 3, 4, gl.FLOAT, false, 0, destOffset );
        destOffset += 4 * mesh.boneWeight.length;
        gl.vertexAttribPointer( 4, 4, gl.UNSIGNED_SHORT, false, 0, destOffset );

        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo[i] );
        gl.uniformMatrix4fv( modelingLoc,   0, flatten(object.transform) );
        gl.drawElements( gl.TRIANGLES, mesh.faces.length, gl.UNSIGNED_SHORT, 0 );
    }
	
}
