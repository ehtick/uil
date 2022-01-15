import * as THREE from '../build/three.module.js';
import { mergeVertices, mergeBufferGeometries } from '../examples/jsm/utils/BufferGeometryUtils.js';
import { SimplexNoise } from '../examples/jsm/math/SimplexNoise.js';

export class Landscape extends THREE.Mesh {

    constructor( o = {} ) {

        super()

        this.ready = false;

        this.type = 'terrain';

        this.callback = o.callback || null;

        this.perlin = null;

        this.p90 = Math.PI*0.5;

        this.textures = {};
        this.loaderMap = null;

        this.mapN = 0;
        this.mapMax = 6;

        // terrain, water, road
        this.ttype = o.terrainType || 'terrain';

        this.callback = o.callback || null;
        //this.physicsUpdate = function(){};

        this.uvx = [ o.uv || 18, o.uv || 18 ];


        this.sample = o.sample == undefined ? [128,128] : o.sample;
        this.size = o.size === undefined ? [100,30,100] : o.size;

        this.data = o.data || {
            move:[0,0],
            height: this.size[1],
            level: o.level || [1,0.2,0.05],
            frequency: o.frequency || [0.016,0.05,0.2],
            expo: o.expo || 1,
        }

        this.isWater = o.water || false;

        this.isBorder = false;
        this.wantBorder = o.border || false;

        this.isBottom = false;
        this.wantBottom = o.bottom || false;
        this.wantBorder = o.border || false;

        this.colorBase = this.isWater ? { r:0, g:0.7, b:1 } : { r:0.25, g:0.25, b:0.25 };

        this.maxspeed = o.maxSpeed || 0.1;
        this.acc = o.acc == undefined ? 0.01 : o.acc;
        this.dec = o.dec == undefined ? 0.01 : o.dec;

        this.deep = o.deep == undefined ? 0 : o.deep;

        this.ease = new THREE.Vector2();

        // for perlin
        this.complexity = o.complexity == undefined ? 30 : o.complexity;
        this.complexity2 = o.complexity2 == undefined ? null : o.complexity2;

        this.local = new THREE.Vector3();
        if( o.local ) this.local.fromArray( o.local );

        this.pp = new THREE.Vector3();

        this.lng = this.sample[0] * this.sample[1];
        var sx = this.sample[0] - 1;
        var sz = this.sample[1] - 1;
        this.rx = sx / this.size[0];
        this.rz = sz / this.size[2];
        this.ratio = 1 / this.sample[0];
        this.ruvx =  1.0 / ( this.size[0] / this.uvx[0] );
        this.ruvy = - ( 1.0 / ( this.size[2] / this.uvx[1] ) );

        this.is64 = o.is64 || false;

        this.isTurn = o.turn || false;

        this.heightData = [];//this.is64 ? new Float64Array( this.lng ) : new Float32Array( this.lng );
        this.height = [];


        this.underWater = o.underWater || 0;

        this.isAbsolute = o.isAbsolute || false;
        this.isReverse = o.isReverse || false;
        if( this.isReverse ) this.getReverseID();

        this.colors = new Float32Array( this.lng * 3 );
        this.geometry = new THREE.PlaneBufferGeometry( this.size[0], this.size[2], this.sample[0] - 1, this.sample[1] - 1 );
        this.geometry.rotateX( -this.p90 );
        if( this.isTurn ) this.geometry.rotateY( -this.p90 );



     
       // this.geometry.computeBoundingSphere();

        this.geometry.setAttribute( 'color', new THREE.BufferAttribute( this.colors, 3 ) );
        //this.geometry.setAttribute( 'uv2', this.geometry.attributes.uv );
        this.vertices = this.geometry.attributes.position.array;




        var isORM = false;
        var clevels = new THREE.Quaternion( 0.95, 0.8, 0.1, 0.05 ); 
        if( o.maplevels ) clevels.fromArray( o.maplevels );
        var T = TerrainShader;
        var maps = o.maps || [ 'sand', 'grass', 'rock' ], txt = {};
        var name;

        if(this.isWater) maps = ['water'];

        for( var i in maps ){

            name = maps[i];
            txt[name] = this.loadTextures('./assets/textures/terrain/'+name+'.jpg', { flip:false, repeat:this.uvx, encoding:o.encoding, callback: this.mapcallback.bind(this)  });
            txt[name+'_n'] = this.loadTextures('./assets/textures/terrain/'+name+'_n.jpg', { flip:false, repeat:this.uvx, callback: this.mapcallback.bind(this) });
            if( isORM )txt[name+'_n'] = this.loadTextures('./assets/textures/terrain/'+name+'_n.jpg', { flip:false, repeat:this.uvx, callback: this.mapcallback.bind(this) });

        }

        this.material = new THREE.MeshStandardMaterial({ name:'terrain', vertexColors:THREE.VertexColors, color:0xFFFFFF, map:txt[maps[0]], normalMap:txt[maps[0]+'_n'], envMap:o.envMap || null });

        if( o.envmap !== undefined ) this.material.envMap = o.envmap 

        if( this.isWater ){
            this.material.transparent = true;
            this.material.opacity = o.opacity || 0.4;
            this.material.side = THREE.DoubleSide;
            this.material.alphaMap = txt[maps[0]];
            this.material.map = null;
            this.material.metalness = 0.9;
            this.material.roughness = 0.1;
        } else {
            this.material.metalness = 0.6;
            this.material.roughness = 0.4; 
        }

        if( isORM ){
            this.material.metalness = 1; 
            this.material.roughness = 1; 
        }

        var ns = o.nScale || 1;
        this.material.normalScale.set(ns,ns);

        if( !this.isWater ){

            this.material.onBeforeCompile = function ( shader ) {

                var uniforms = shader.uniforms;

                //uniforms['fogTime'] = { value: 0 };

                uniforms['clevels'] = { value: clevels };

                uniforms['map1'] = { value: txt[maps[1]] };
                uniforms['map2'] = { value: txt[maps[2]] };

                uniforms['normalMap1'] = { value: txt[maps[1]+'_n'] };
                uniforms['normalMap2'] = { value: txt[maps[2]+'_n'] };

                //uniforms['underWater'] = { value: o.underWater || 0.1 };
                uniforms['waterColor'] = { value: new THREE.Color( o.waterColor || 0x3b4c5a ) };

                shader.uniforms = uniforms

                var fragment = shader.fragmentShader;

                fragment = fragment.replace( 'uniform vec3 diffuse;', T.baseRemplace );

                fragment = fragment.replace( '#include <map_fragment>', T.map );
                fragment = fragment.replace( '#include <normal_fragment_maps>', T.normal );
                fragment = fragment.replace( '#include <color_fragment>', '' );

                if( isORM ){

                    fragment = fragment.replace( '#include <normalmap_pars_fragment>', T.normal_pars );
                        
                    fragment = fragment.replace( '#include <roughnessmap_pars_fragment>', T.rough_pars );
                    fragment = fragment.replace( '#include <metalnessmap_pars_fragment>', '' );
                    fragment = fragment.replace( '#include <aomap_pars_fragment>', '' );

                    
                    fragment = fragment.replace( '#include <roughnessmap_fragment>', T.rough );
                    fragment = fragment.replace( '#include <metalnessmap_fragment>', '' );
                    fragment = fragment.replace( '#include <aomap_fragment>', T.ao );

                }
                
                shader.fragmentShader = fragment;

                if( o.shader ) o.shader.modify( shader );

            }

        } else {

            this.material.onBeforeCompile = function ( shader ) {

                var fragment = shader.fragmentShader;

                fragment = fragment.replace( '#include <alphamap_fragment>', T.alphamap );


                
                shader.fragmentShader = fragment;

            }

        }

        /*var test = new THREE.Mesh( new THREE.SphereGeometry(4), new THREE.MeshStandardMaterial({ metalness:1, roughness:0, envMap:o.envMap || null } ));
        test.position.y = 5
            this.add( test );*/


        //THREE.Mesh.call( this, this.geometry, this.material );

        if(o.debuger){
            var debuger = new THREE.Mesh( this.geometry, new THREE.MeshBasicMaterial({ wireframe:true } ));
            this.add( debuger );
        }

        //root.garbage.push( this.geometry );
        

        if( this.wantBorder ) this.addBorder( o );
        if( this.wantBottom ) this.addBottom( o );

        this.name = o.name === undefined ? 'terrain' : o.name;
        if( o.pos ) this.position.fromArray( o.pos );
        if( o.decal ) this.position.y += o.decal;


        this.castShadow = true;
        this.receiveShadow = true;


        this.update();

        //if(this.callback) this.callback()

    }

    loadTextures ( url, o ) {

        o = o || {};

        if( this.loaderMap === null ) this.loaderMap = new THREE.TextureLoader();

        let name = url.substring( url.lastIndexOf('/')+1, url.lastIndexOf('.') );

        if( this.textures[ name ] ){

            if( o.callback ) o.callback();
            return this.textures[name];
            
        }

        this.textures[name] = this.loaderMap.load( url, function ( t ) {

            t.name = name;

            if( o.encoding ) t.encoding = THREE.sRGBEncoding;

            t.flipY = o.flip !== undefined ? o.flip : true;

            if( o.anisotropy !== undefined ) t.anisotropy = o.anisotropy;
            if( o.generateMipmaps !== undefined ) t.generateMipmaps = o.generateMipmaps;

            if( o.repeat ){
                t.repeat.fromArray( o.repeat );
                t.wrapS = THREE.RepeatWrapping;
                t.wrapT = THREE.RepeatWrapping;
            }

            if(o.filter){
                if(o.filter === 'near' ){
                    t.minFilter = THREE.NearestFilter;
                    t.magFilter = THREE.NearestFilter;
                }
            }

            if( o.callback ) o.callback();

        });

        return this.textures[name];

    }

    mapcallback (){

        //if( this.callback === null ) return;

        this.mapN++;
        if( this.mapN == this.mapMax ) this.callback();

    }

    addBottom ( o ){

    	var geometry = new THREE.PlaneBufferGeometry( this.size[0], this.size[2], 1, 1 );
        geometry.rotateX( this.p90 );
        

        this.bottomMesh = new THREE.Mesh( geometry, this.borderMaterial );

        this.add( this.bottomMesh );

        this.isBottom = true;
    }

    addBorder ( o ){

    	this.borderMaterial = new THREE.MeshStandardMaterial({ 

    		vertexColors: THREE.VertexColors, 
    		metalness: this.isWater ? 0.8 : 0.4, 
       		roughness: this.isWater ? 0.2 : 0.6, 
       
            //envMap: view.getEnvMap(),
            //normalMap:this.wn,
            normalScale:this.isWater ?  [0.25,0.25]:[-1,-1],
            transparent:this.isWater ? true : false,
            opacity: this.isWater ? (o.opacity || 0.8) : 1,
            envMap: o.envMap || null, 
    		//shadowSide : false

    	});

    	//view.getMat()[this.name+'border'] = this.borderMaterial;

        var front = new THREE.PlaneGeometry( this.size[0], 2, this.sample[0] - 1, 1 );
        var back = new THREE.PlaneGeometry( this.size[0], 2, this.sample[0] - 1, 1 );
        var left = new THREE.PlaneGeometry( this.size[2], 2, this.sample[1] - 1, 1 );
        var right = new THREE.PlaneGeometry( this.size[2], 2, this.sample[1] - 1, 1 );

        front.translate( 0,1, this.size[2]*0.5);
        back.rotateY( -Math.PI );
        back.translate( 0,1, -this.size[2]*0.5);
        left.rotateY( -this.p90 );
        left.translate( -this.size[0]*0.5,1, 0);
        right.rotateY( this.p90 );
        right.translate( this.size[0]*0.5,1, 0);

        this.borderGeometry = mergeVertices( mergeBufferGeometries( [ front, back, left, right ] ) );
        this.borderVertices = this.borderGeometry.attributes.position.array;
        this.lng2 = this.borderVertices.length / 3;
        this.list = new Array( this.lng2 )
        this.borderColors = new Float32Array( this.lng * 3 );
        this.borderGeometry.setAttribute( 'color', new THREE.BufferAttribute( this.borderColors, 3 ) );
        this.borderMesh = new THREE.Mesh( this.borderGeometry, this.borderMaterial );

        var j = this.lng2, n, i;
        while(j--){
            n = j*3;
            i = this.borderVertices[n+1] > 0 ? this.findPoint( this.borderVertices[n], this.borderVertices[n+2] ) : -1;
            this.list[j] = i;

        }

        this.add( this.borderMesh );

        this.borderMesh.castShadow = true;
        this.borderMesh.receiveShadow = true;

        this.isBorder = true;

    }

    setData ( d ) {

        this.data = d;
        this.update();

    }

    dispose () {

        this.geometry.dispose();
        this.material.dispose();
        
    }

    easing ( key, azimuthal, wait ) {

        key = key || user.key;

        if( !key[0] || !key[1] ) return;

        var r = azimuthal || 0;//view.getAzimuthal();

        if( key[7] ) this.maxspeed = 1.5;
        else this.maxspeed = 0.25;

        //acceleration
        this.ease.y += key[1] * this.acc; // up down
        this.ease.x += key[0] * this.acc; // left right
        //speed limite
        this.ease.x = this.ease.x > this.maxspeed ? this.maxspeed : this.ease.x;
        this.ease.x = this.ease.x < -this.maxspeed ? -this.maxspeed : this.ease.x;
        this.ease.y = this.ease.y > this.maxspeed ? this.maxspeed : this.ease.y;
        this.ease.y = this.ease.y < -this.maxspeed ? -this.maxspeed : this.ease.y;

        //break
        if (!key[1]) {
            if (this.ease.y > this.dec) this.ease.y -= this.dec;
            else if (this.ease.y < -this.dec) this.ease.y += this.dec;
            else this.ease.y = 0;
        }
        if (!key[0]) {
            if (this.ease.x > this.dec) this.ease.x -= this.dec;
            else if (this.ease.x < -this.dec) this.ease.x += this.dec;
            else this.ease.x = 0;
        }

        if ( !this.ease.x && !this.ease.y ) return;

        this.local.z += Math.sin(r) * this.ease.x + Math.cos(r) * this.ease.y;
        this.local.x += Math.cos(r) * this.ease.x - Math.sin(r) * this.ease.y;

        this.update( wait );

    }

    getHeight ( x, z ) {



        x *= this.rx;
        z *= this.rz; 
        x += this.sample[0]*0.5;
        z += this.sample[1]*0.5;

        //this.pv.set( x, 0, z ).applyAxisAngle( {x:0, y:1, z:0}, -this.p90 )

        /*if( this.isTurn ){
            x = Math.floor(-z);
            z = Math.floor(x);
        }else {*/
            x = Math.floor(x);
            z = Math.floor(z);
        //}

        
        
        var h = this.isTurn ? this.height[ this.findId2( x, z ) ] : this.height[ this.findId( x, z ) ];
        return ( h * this.size[ 1 ] ) + this.position.y;

    }

    findId( x, z ){

        return x+(z*this.sample[1]) || 1;

    }

    findId2( x, z ){

        return z+(-x*this.sample[0]) || 1;

    }

    findPoint( x, z ){

        var i = this.lng, n;
        while( i-- ){
            n = i * 3;
            if( this.vertices[ n ] === x && this.vertices[ n + 2 ] === z ) return i;
        }

        return -1;

    }

    getReverseID () {

        this.invId = [];

        var i = this.lng, n, x, z, zr, c, l=0;
        var sz = this.sample[1] - 1;

        while(i--){
            x = i % this.sample[0];
            z = Math.floor( i * this.ratio );
            zr = sz - z;
            this.invId[i] = this.findId( x, zr );
        }

    }

    clamp (v, min, max) {

        //return Math.max( min, Math.min( max, value ) );
        v = v < min ? min : v;
        v = v > max ? max : v;
        return v;
    }

    noise ( v, o ) {

        if( this.perlin === null ) this.perlin = new SimplexNoise();

        o = o || {};

        var level = o.level || [ 1, 0.2, 0.05 ];
        var frequency  = o.frequency  || [ 0.016, 0.05, 0.2 ];

        var i, f, c=0, d=0;

        for(i=0; i<level.length; i++){

            f = frequency[i];
            c += level[i] * ( 0.5 + this.perlin.noise3d( v.x*f, v.y*f, v.z*f ) * 0.5 );
            d += level[i];

        }

        c/=d;

        return c;

    }

    update ( wait ) {

        this.size[1] = this.data.height;


        if( this.isWater ){ 
            this.material.normalMap.offset.x+=0.002;
            this.material.normalMap.offset.y+=0.001;
        } else {
            this.material.map.offset.x = this.local.x * this.ruvx;
            this.material.map.offset.y = this.local.z * this.ruvy;
        }

        var v = this.pp;
        var cc = [1,1,1];
        var i = this.lng, n, x, z,  c, l=0, id, result;
        var oldz, oldh, ccY;

        while( i-- ){

            n = i * 3;
            x = i % this.sample[0];
            z = Math.floor( i * this.ratio );

            v.set( x + ( this.local.x*this.rx ), this.local.y, z + ( this.local.z*this.rz ) );



            //c = math.noise( v, this.data );
            c = this.noise( v, this.data );



            //c = Math.quinticSCurve(c);
            //c = Math.cubicSCurve(c)
            //c = Math.linear(c,0.2, 1);
            //c = Math.clamp(c,0.2,1)

            c = Math.pow( c, this.data.expo );

            this.clamp( c, 0, 1);
            
            


            if( this.ttype === 'road' ) {

                if(oldz === z){
                    if(x===1 || x===2 || x===29 || x===30) c = oldh + 0.1;
                    else c = oldh;
                } else { 
                    oldz = z;
                    oldh = c;

                }

                //console.log(x)
            }

            this.height[ i ] = c;

            id = this.isReverse ? this.invId[i] : i;
            //result = this.isAbsolute ? c : c * this.size[1];

            this.heightData[ id ] = this.isAbsolute ? c : (c * this.size[ 1 ]) + this.deep;

            ccY = (c * this.size[ 1 ]) + this.deep;

            

            this.vertices[ n + 1 ] = ccY;

            if( this.isWater ){

                cc = [ c * this.colorBase.r, c * this.colorBase.g, c * this.colorBase.b ];

            } else {

                cc = [ c, 0, 0];

                if( ccY < this.underWater ) cc[2] = 1.25-(ccY/this.underWater);////1;

            }

            //var ccc = this.clamp(cc[0]+0.25, 0.25, 1)

            this.colors[ n ] = cc[0];
            this.colors[ n + 1 ] = cc[1];
            this.colors[ n + 2 ] = cc[2];
            //oldx = x;
            

        }


        if( this.isBorder ){

            var j = this.lng2, h;
            while(j--){
                n = j*3;
                if(this.list[j]!==-1){
                    h = this.height[ this.list[j] ];
                    this.borderVertices[n+1] = (h * this.size[1]) + this.deep;
                    var ccc = this.clamp(h+0.25, 0.25, 1)
                    var ee = (0.5 + h+0.5);
                    ee = ee > 1 ? 1 : ee;
                    ee = ee < 0.5 ? 0.5 : ee;
                    this.borderColors[n] = ccc //* this.colorBase.r;//h * this.colorBase.r//ee;
                    this.borderColors[n+1] = ccc //* this.colorBase.g;// h * this.colorBase.g//ee*0.5;
                    this.borderColors[n+2] = ccc //* this.colorBase.b;// h * this.colorBase.b//ee*0.3;

                } else{
                    this.borderColors[n] = this.colorBase.r//0.5;
                    this.borderColors[n+1] = this.colorBase.g//0.25;
                    this.borderColors[n+2] = this.colorBase.b//0.15;
                }
            }

        }

        this.updateGeometry();

        this.ready = true;

        //if( phy ) root.view.update( { name:'terra', heightData:this.heightData, sample:this.sample } );

    }

    updateGeometry () {

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.computeVertexNormals();

 
        if( this.isBorder ){
        	this.borderGeometry.attributes.position.needsUpdate = true;
            this.borderGeometry.attributes.color.needsUpdate = true;
        }

    }

}

// SHADERS

const TerrainShader = {

    baseRemplace : /* glsl */`
        uniform vec3 diffuse; 
        uniform vec4 clevels;

        //uniform float underWater;
        uniform vec3 waterColor;

        uniform sampler2D normalMap1;
        uniform sampler2D normalMap2;

        uniform sampler2D roughnessMap1;
        uniform sampler2D roughnessMap2;

        uniform float aoMapIntensity;
        uniform sampler2D map1;
        uniform sampler2D map2;

        vec4 MappingMix( float slope, vec4 level, vec4 rocks, vec4 grasss, vec4 sands ){
            vec4 cc = rocks;
            if (slope < level.y) cc = grasss;
            if (slope < level.z) cc = sands;
            if (( slope < level.x ) && (slope >= level.y)) cc = mix( grasss , rocks, (slope - level.y) * (1. / (level.x - level.y)));
            if (( slope < level.y ) && (slope >= level.z)) cc = mix( sands , grasss, (slope - level.z) * (1. / (level.y - level.z)));
            return cc;
        }
    `,

    rough : /* glsl */`
        float roughnessFactor = roughness;
        float metalnessFactor = metalness;
        #ifdef USE_ROUGHNESSMAP

            vec4 sandR = texture2D( roughnessMap, vUv );
            vec4 grassR = texture2D( roughnessMap1, vUv );
            vec4 rockR = texture2D( roughnessMap2, vUv );

            vec4 baseColorR = MappingMix( vColor.r, clevels, rockR, grassR, sandR );

            // reads channel G, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
            float ambientOcclusion =( baseColorR.r - 1.0 ) * aoMapIntensity + 1.0;
            roughnessFactor *= baseColorR.g;
            metalnessFactor *= baseColorR.b;
        #endif
    `,

    // ao

    ao : /* glsl */`
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );
        #endif
    `,

    // map

    map : /* glsl */`
        #ifdef USE_MAP

            vec4 sand = texture2D( map, vUv );
            vec4 grass = texture2D( map1, vUv );
            vec4 rock = texture2D( map2, vUv );

            vec4 baseColor = MappingMix( vColor.r, clevels, rock, grass, sand );

            baseColor = mix( baseColor, vec4( waterColor, 1.0 ), vColor.b );

            //if ( vColor.b < underWater ) baseColor *= vec4( waterColor, 0.25 );

            //diffuseColor *= mapTexelToLinear( baseColor );
            diffuseColor *= baseColor;

        #endif
    `,

    // normal

    normal : /* glsl */`
        #ifdef USE_NORMALMAP
            vec4 sandN =  texture2D( normalMap, vUv );
            vec4 grassN = texture2D( normalMap1, vUv );
            vec4 rockN = texture2D( normalMap2, vUv );

            vec3 extraNormal = MappingMix(vColor.r, clevels, rockN, grassN, sandN).xyz * 2.0 - 1.0;
            extraNormal.xy *= normalScale;
            normal = perturbNormal2Arb( -vViewPosition, normal, extraNormal, faceDirection );
        #endif
    `,

    alphamap : /* glsl */`
        #ifdef USE_ALPHAMAP
            diffuseColor.a = opacity +( texture2D( alphaMap, vUv ).g * opacity) * (1.0-opacity);
        #endif
    `,
    
}