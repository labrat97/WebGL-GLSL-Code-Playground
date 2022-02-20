#version 100
precision highp float;

#define GRADIENT_DELTA 0.5
#define FUDGE_FACTOR 0.5
#define COMPARE_FUDGE_FACTOR 0.2
#define PHI ((1.+sqrt(5.))/2.)

// Pull in program data
uniform vec2 winsize;
uniform float minwid;
uniform int time;
uniform int now;
uniform sampler2D backbuffer;

float length2( vec2 p )
{
	return sqrt( p.x*p.x + p.y*p.y );
}

float length6( vec2 p )
{
	p = p*p*p; p = p*p;
	return pow( p.x + p.y, 1.0/6.0 );
}

float length8( vec2 p )
{
	p = p*p; p = p*p; p = p*p;
	return pow( p.x + p.y, 1.0/8.0 );
}

float sdTorus82( vec3 p, vec2 t )
{
  vec2 q = vec2(length2(p.xz)-t.x,p.y);
  return length8(q)-t.y;
}

float sdTorus88( vec3 p, vec2 t )
{
  vec2 q = vec2(length8(p.xz)-t.x,p.y);
  return length8(q)-t.y;
}

float sdTorus( vec3 p, vec2 t )
{
  return length(vec2(length(p.xz)-t.x,p.y))-t.y;
}

mat3 rotateY(float r)
{
    vec2 cs = vec2(cos(r), sin(r));
    return mat3(cs.x, 0, cs.y, 0, 1, 0, -cs.y, 0, cs.x);
}

mat3 rotateZ(float r)
{
    vec2 cs = vec2(cos(r), sin(r));
    return mat3(cs.x, cs.y, 0., -cs.y, cs.x, 0., 0., 0., 1.);
}

float DE(vec3 p0)
{
	//vec3 p=p0+sin(p0.yzx*4.0+2.4*sin(p0.zxy*5.0+time)+time*0.7)*0.5;
	//float d=length(p)-1.0;
    float t = float(now)*.3/1000.;
	mat3 m = rotateZ(t)*rotateY(t*.5);
    vec3 p = p0*m;
	float d = length(p0)+1.;
    float r = 1./PHI;
    for(int i = 0; i < 9; ++i)
    {
        d = min(d, sdTorus(p, vec2(r, 0.015)));
        p *= m;
        r -= .15;
    }
    return d;
}

vec2 DDE(vec3 p, vec3 rd){
	float d1=DE(p);
  	return vec2(d1,d1*COMPARE_FUDGE_FACTOR);
	float dt=GRADIENT_DELTA*log(d1+1.0);
	float d2=DE(p+rd*dt);
	dt/=max(dt,d1-d2);
	return vec2(d1,FUDGE_FACTOR*log(d1*dt+1.0));
}

float rndStart(vec2 co){return fract(sin(dot(co,vec2(123.42,117.853)))*412.453);}

mat3 lookat(vec3 fw,vec3 up){
	fw=normalize(fw);vec3 rt=normalize(cross(fw,up));return mat3(rt,cross(rt,fw),fw);
}

vec3 normal(vec3 p)
{
    vec2 eps = vec2(.001, 0.);
    return normalize(vec3(
        DE(p+eps.xyy) - DE(p-eps.xyy),
        DE(p+eps.yxy) - DE(p-eps.yxy),
        DE(p+eps.yyx) - DE(p-eps.yyx)));
}

vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

	return c.z * mix( vec3(1.0), rgb, c.y);
}

float calcAO( in vec3 pos, in vec3 nor )
{
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<7; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
        float dd = DE( aopos );
        occ += -(dd-hr)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
}

float softshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
	float res = 1.0;
    float t = mint;
    for( int i=0; i<8; i++ )
    {
		float h = DE( ro + rd*t );
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0.3, 1. );
}


vec3 compute_color(vec3 ro, vec3 rd, float t)
{
    vec3 l = normalize(vec3(0., .7, .2));
    vec3 p = ro+rd*t;
    vec3 nor = normal(p);
    vec3 ref = reflect(rd, nor);
    
    vec3 c = hsv2rgb(vec3(-0.1+(pow(length(p),2.)*0.05*PHI), 1.3-(length(p)*.2), .9));
    
    float dif = clamp( dot( nor, l ), 0.0, 1.0 );//*softshadow(p, l, 0.02, 2.5);
    float dom = smoothstep( -0.1, 0.1, ref.y );//*softshadow(p, ref, 0.02, 2.5);
   	float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
    
    float ao = calcAO(p, nor);
    
    vec3 v = vec3(0.);
    v += .3*vec3(dif);
    v += .3*dom*vec3(.6, .7, .9)*ao;
    v += .6*fre*vec3(.7, .8, .6)*ao;
 	return c*v;
}

vec4 pixel(vec2 pxx)
{
    float pxl=4.0/1.;//find the pixel size
	float tim=float(now)/1000.;
	
	//position camera
	vec3 ro=vec3(cos(tim),-0.5,sin(tim))*3.4;
	vec3 rd=normalize(vec3((2.0*pxx-vec2(1.,1.))/1.,2.0));
	rd=lookat(-ro,vec3(0.0,1.0,0.0))*rd;
	//ro=eye;rd=normalize(dir);
	vec3 bcol=vec3(1.0);
	//march
	
	float t=DDE(ro,rd).y*rndStart(pxx),d,od=1.0;
    bool hit = false;
	vec4 col=vec4(0.);//color accumulator
	for(int i=0;i<120;i++){
		vec2 v=DDE(ro+rd*t,rd);
		d=v.x;//DE(ro+rd*t);
		float px=pxl*(1.0+t);
		if(d<px){
            hit = true;
            break;
		}
		od=d;
		t+=v.y;//d;
		if(t>10.0)break;
	}
    return hit ? vec4(compute_color(ro, rd, t), 1.) : 
    			 hsv2rgb(vec3(0., 1., 0.)).xyzz*.2;
}

void main(){
    vec2 xy = gl_FragCoord.xy/minwid;
	float v = .6 + 0.4*pow(20.0*xy.x*xy.y*(1.0-xy.x)*(1.0-xy.y), 0.5);
	gl_FragColor=pow(pixel(gl_FragCoord.xy)*v, vec4(1./2.2));
} 
