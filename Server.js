let Server = {
    timer_imager:null,
    client:[null,null],
    gameOn:false,
    wss:null,
    startServer:function(){
        let WebSocketServer = require("ws").Server;
        this.wss = new WebSocketServer({ port: 3000 });
        this.wss.on("connection", function (ws,req) {
            ws.on("message", function (message) {
                //console.log("CLIENT: %s", message);
                if(message[0]=="^")
                if(Server.gameOn)Server.requestHandlerGameOn(ws,message);
                else Server.requestHandlerGameOff(ws,message);
            });
            ws.on("error",function(error){

            });
            ws.on("close",function(){
                if(Server.gameOn)Server.requestHandlerGameOn(ws,"^nl");
                else Server.requestHandlerGameOff(ws,"^nl");
            })
        });
    },
    sendImagers:function(){
        let imagers=[];
        for (let j = Game.channel[Game.PHYSICS_CHANNEL].length - 1, c = Game.channel[Game.PHYSICS_CHANNEL]; j >= 0; j--) { imagers[j]=c[j].getImager();}
        for (let j = Game.channel[Game.TEXT_CHANNEL].length - 1, c = Game.channel[Game.TEXT_CHANNEL]; j >= 0; j--) { imagers.push(c[j].getImager());}
        imagers=JSON.stringify(imagers);
        Server.client[0].send(imagers);
        Server.client[1].send(imagers);
    },
    requestHandlerGameOff:function(ws,message){
        switch(message[2]){
        case "a": //access
            if(message[1]!="n")break;
            if(this.client[0]==null){this.client[0]=ws;ws.send("*0a");console.log("플레이어 참가[0]");}
            else if(this.client[1]==null){this.client[1]=ws;ws.send("*1a");console.log("플레이어 참가[1]");}
            break;
        case "m": //magic
            if(message[1]=="n")break;
            let num=Number(message[1]);
            let magic=message.substr(3, message.length-3);
            Game.compileMagic(num, magic);
            console.log("마법 로드 완료["+num+"]");
            //마법로드가완료되면시작
            setTimeout(function(){if(Server.client[0]!=null&&Server.client[1]!=null){Server.setGameStatus(true);}},2000);
            break;
        case "l": //leave
            if(Server.client[0]===ws){Server.client[0]=null;Game.magicCode[0]=null;console.log("플레이어 퇴장[0]");}
            else if(Server.client[1]===ws){Server.client[1]=null;Game.magicCode[1]=null;console.log("플레이어 퇴장[1]");};
            break;
        }
    },
    requestHandlerGameOn:function(ws,message){
        switch(message[2]){
        case "d": Game.keyDownHandler(Number(message[1]),message[3]);break;//keyboard up
        case "u": Game.keyUpHandler(Number(message[1]),message[3]);break;//keyboard up
        case "l": 
            if(Server.client[0]===ws){Game.player[0].removeHandler();console.log("플레이어 퇴장[0]");}
            else if(Server.client[1]===ws){Game.player[1].removeHandler();console.log("플레이어 퇴장[1]");};
            break;
        case "a":ws.send("*na");break;
        }
    },
    setGameStatus:function(s){
        if(s===this.gameOn)return;
        this.gameOn=s;
        if(s){
            console.log("게임 시작");
            Game.startGame();
            this.client[0].send("*ns");
            this.client[1].send("*ns");
            Game.player[0].removeHandler=function(){
                Game.endGame(1);Server.client[0].send("*l1");Server.client[1].send("*l1");Server.setGameStatus(false);}
            Game.player[1].removeHandler=function(){
                Game.endGame(0);Server.client[0].send("*l0");Server.client[1].send("*l0");Server.setGameStatus(false);}
            Server.timer_imager=setInterval(Server.sendImagers,10);
        }else{
            console.log("게임 종료");
            this.client=[null,null];
            clearInterval(Server.timer_imager);
        }
    }
}

Server.startServer();

let Game = {
    timer_game:null,
    time: 0,
    p:null,
    player:[null,null],
    magicCode:[null,null],
    channel: [[], [], []], //phisics, particle, button
    PHYSICS_CHANNEL: 1,
    PARTICLE_CHANNEL: 0,
    TEXT_CHANNEL: 2,
    startGame: function () {
        Game.resetGame();
        //make maps
        this.player[0]=new Player(50,-200,10);
        this.player[1]=new Player(500,-200,10);
        Game.player[0].magicList=Game.magicCode[0];
        Game.player[1].magicList=Game.magicCode[1];
        const WALL_SIZE=300;
        const MAP_W=2000;
        const MAP_H=1000;
        new MapBlock(0,0,MAP_W,WALL_SIZE,"grass");
        new MapBlock(-WALL_SIZE,-MAP_H,WALL_SIZE,MAP_H+WALL_SIZE);
        new MapBlock(0,-MAP_H,MAP_W,WALL_SIZE);
        new MapBlock(MAP_W,-MAP_H,WALL_SIZE,MAP_H+WALL_SIZE);
        this.timer_game=setInterval(Game.updateGame,8);
    },

    updateGame: function () {
        for (let i = 0; i < 3; i++) {
            for (let j = Game.channel[i].length - 1, c = Game.channel[i]; j >= 0; j--) { c[j].update(); }
            for (let e of Game.channel[i]) {
                if (e.life < 1 && e.canRemoved) {
                    e.removeHandler();
                    let ei = Game.channel[i].indexOf(e);
                    if (ei >= 0) Game.channel[i].splice(ei, 1);
                }
            }
        }
        Game.time++;
    },
    endGame:function(winnerNum){
        clearInterval(Game.timer_game);
        console.log("player"+winnerNum+" win");
        this.resetGame();
    },
    keyDownHandler:function(num,code) {
        let p=Game.player[num];
        switch (code) {
            case "0":p.moveFlag = true;p.isRight = true;break;//right
            case "1":p.moveFlag = true;p.isRight = false;break;//left
            case "2":p.jump();break;//up
            case "q":p.castMagic(0);break; //q
            case "w":p.castMagic(1);break; //w
            case "e":p.castMagic(2);break; //e
            case "r":p.castMagic(3);break; //r
        }
    },
    keyUpHandler:function(num,code) {
        let p=Game.player[num];
        switch(code){
            case "0":p.moveFlag = false;break;
            case "1":p.moveFlag = false;break;
        }
    },
    resetGame: function () {
        //this.magicCode=[null,null];
        this.channel=[[],[],[]];
        this.time=0;
    },
    compileMagic:function(num,magic){
        let magicCodeText=JSON.parse(magic);
        let magicList=[];
        for(let i=0;i<4;i++){
            if(magicCodeText[i]===null){//만약 마법이 없으면
                magicList[i]=["none",function(){},100,100,1];
                continue;
            }
            let temp = Magic.convertMagictoJS(magicCodeText[i][0], magicCodeText[i][1]);
            if(temp==null)magicList[i]=["none",function(){},100,100,1];
            else magicList[i]=temp;
        }
        Game.magicCode[num]=magicList;
    }
}

let Magic = {
    convertMagictoJS: function (name, magicCode) {
        let magicFactor = [100,100]; //[cooltime, magic point]
        let jsCode="";
        let testCode="";
        let temp =""; //문자열이 일시적으로 담기는곳
        //caculate magicFactor(cooltime, magic point)
        function getEnergy(e){ //엔티티가 가지고 있는 데미지를 반환
            let test = new Entity(0,10000,Game.PHYSICS_CHANNEL);
            test.life=0;
            e.collisionHandler(test);
            return Math.abs(test.life);
        }
        function addMF(mf) {
            magicFactor[0] = Math.floor(Math.sqrt(magicFactor[0]**2 + mf[0]**2));
            magicFactor[1] += Math.floor(Math.abs(mf[1]));
        }
        let player;
        function setPlayer(p){player=p;}
        function getPlayer(){return player;}
        //UNIT MAGIC FUNCTION
        const FIRE=0, ELECTRICITY=1,ICE=2,ARROW=3,ENERGY=4,SWORD=5,BLOCK=6,TRIGGER=7;
        function create(typenum=BLOCK,vx=0,vy=0,w=30,h=30){
            let e;
            let p=getPlayer();
            if(typenum<=SWORD)e=new Matter(typenum,0,0,vx,vy);
            else if(typenum===BLOCK)e=new Block(0,0,w,h);
            else if(typenum===TRIGGER)e=new Trigger(0,0,w,h,100,function(e){});
            e.vx=vx;e.vy=vy;e.x=p.getX()+front(e.w/2+p.w/2)-e.w/2;e.y=p.getY()-e.h/2;
            return e;
        }
        function setTrigger(t,f){if(t instanceof Trigger)t.code=f;}
        function giveForce(e,ax,ay){e.vx+=ax;e.vy+=ay;}
        function giveLife(e,d){e.life+=d;}
        function invisible(e,time){e.canDraw=false;e.addAction(time,time,function(){e.canDraw=true;});}
        function move(e,vx,vy){e.x+=vx;e.y-=vy;}
        function addAction(e,startTime,endTime,f){e.addAction(startTime,endTime,f);}
        function getX(e){return e.getX()-getPlayer().getX();}
        function getY(e){return getPlayer().getY()-e.getY();}
        function getVX(e){return e.vx;}
        function getVY(e){return e.vy;}
        function front(d=1){return (getPlayer().isRight ? d : -d);}
        //TEST FUNCTION
        function test_giveForce(e,ax,ay){let oldE = getEnergy(e);giveForce(e,ax,ay);let newE=getEnergy(e);addMF([0, newE-oldE]);}
        function test_giveLife(e,d){addMF([0,d]);giveLife(e,d);}
        function test_invisible(e,time){addMF([time*2,(e instanceof Player?(time**2)/100:time)]);}
        function test_move(e,vx,vy){addMF([0,(vx+vy)**2/1000]);}
        function test_addAction(e,startTime,endTime,f){
            if(endTime-startTime>100){
                let oldM0 = magicFactor[0];
                let oldM1 = magicFactor[1];
                for(let i=0,j=(endTime-startTime)/10;i<j;i++)f();
                let newM0 = magicFactor[0];
                let newM1 = magicFactor[1];
                addMF([Math.sqrt((newM0**2-oldM0**2)*9), (newM1-oldM1)*9]);
            }else{
                for(let i=0,j=(endTime-startTime);i<j;i++)f();
            }
            addMF([endTime*2,(endTime-startTime)]);
        }
        function test_create(typenum,vx,vy,w,h){let e=create(typenum,vx,vy,w,h);addMF([50,getEnergy(e)]);return e;}
        function test_setTrigger(t,f){setTrigger(t,f);addMF([100,t.w*t.h+getEnergy(t)+1]);}  
        //prohibited keyword
        let prohibitedWord=["new","function","let","var"];
        let prohibitedSymbol=["[",".","$"];
        //test
        let testKeyword=["giveForce","giveLife","invisible", "create","move","addAction","setTrigger"];
        //convert symbol to word
        let symbol={"@":"let ","#":"function"};
        //convert magic code to js code
        function isEnglish(c){return (64<c&&c<91)||(96<c&&c<123);}
        function printError(text1,text2){
            
        }
        for(let i=0, j=magicCode.length;i<j; i++){
            if(isEnglish(magicCode.charCodeAt(i)))temp+=magicCode[i];
            else{
                //prohibit
                if(prohibitedWord.includes(temp)){
                    printError("Fail: "+name, " : your code have prohibited keyword(new, function, let, var)");
                    return null;
                }
                if(prohibitedSymbol.includes(magicCode[i])){
                    printError("Fail: "+name, " : your code have prohibited symbol('[', '.', '$')");
                    return null;
                }
                //convert code to test code
                if(testKeyword.includes(temp))testCode+="test_"+temp;
                else testCode+=temp;
                jsCode+=temp;
                if(magicCode[i] in symbol){
                    testCode+=symbol[magicCode[i]];
                    jsCode+=symbol[magicCode[i]];
                }else{
                    testCode+=magicCode[i];
                    jsCode+=magicCode[i];
                }
                temp="";
            }
        }
        if(temp!=""){
            testCode+=temp;
            jsCode+=temp;
        }
        //running test
        //console.log("js code: ",testCode);
        //console.log("js code: ",jsCode);
        let magic=function(){};
        try {
            //clearInterval(systemclock);
            magic = eval("(function(player){setPlayer(player);"+jsCode+"})");
            let testMagic=eval("(function(player){setPlayer(player);"+testCode+"})");
            let temp = Game.p;
            Game.p = new Player(0,10000);
            Game.p.dieCode=function(){};
            testMagic(Game.p);
            Game.p=temp;
        }catch(e){
            printError("Fail: "+name," : syntex error")
            return null;
        }
        return [name,magic, magicFactor[0],magicFactor[1],1];
    }
}

/*imager type = 
t(type),x,y,w,h는 한글자 나머지는 두글자 축약어
t:Block:1 MapBlock:2 Matter:3 Player:4 Trigger:5 Text:6 투명:0
*/

class Entity{
    channelLevel;
    x = 0; y = 0; w = 0; h = 0; vx = 0; vy = 0; 
    ga = -0.2; friction = 0.4; inv_mass=1;//phisics;
    life = 1;defense=100;
    canDraw = true; //보일 수 있는가
    canMove = true; //움직일 수 있는가
    canAct = true; //행동을 할 수 있는가
    canInteract = true;//다른 물체 상호작용할 수 있는지
    overlap = true;//다른 물체와 겹칠 수 있는지
    canCollision=true; //물리적 충돌을 하는지(flase여도 collisionHandler 작동)
    canRemoved = true; //삭제될 수 있는가
    canFallDie=true;//낙사하는
    action = new Array(); //한 틱마다 행위들 [시작시간, 종료시간-1, 코드]
    constructor(x, y, channelLevel = 0) {
        this.x = x;
        this.y = y;
        this.channelLevel = channelLevel;
        Game.channel[channelLevel][Game.channel[channelLevel].length] = this;
    }
    update() {
        if (this.canAct) this.act();
        if (this.canInteract) this.interact();
        if(this.canMove)this.move();
    }
    getImager(){return {t:0,x:this.x,y:this.y}}
    addAction(start, end, code) {
        let i,j;
        for (i = 0, j=this.action.length; i < j; i++) {
            if (this.action[i][1] >= end + Game.time) break;
        }
        this.action.splice(i, 0, [start + Game.time, end + Game.time, code]);
    }
    act() {
        let i;
        for(i=this.action.length-1; i>=0; i--){
            if (this.action[i][1] < Game.time) break;
            else if (this.action[i][0] <= Game.time) new (this.action[i][2])();  
        }
        this.action.splice(0, i+1);
    }
    interact() {
        let maxV=80;
        if(this.vx>maxV)this.vx=maxV;
        else if(this.vx<-maxV)this.vx=-maxV;
        if(this.vy>maxV)this.vy=maxV;
        else if(this.vy<-maxV)this.vy=-maxV;
        if (this.canFallDie&&this.y > 2000) this.life = 0;
        let downCollision=false;
        for(let i=Game.channel[this.channelLevel].length-1; i>=0; i--){ //check collision
            let e = Game.channel[this.channelLevel][i];
            if (e != this && this.x + this.vx < e.x + e.w&& this.x + this.vx + this.w > e.x && this.y - this.vy < e.y + e.h && this.y - this.vy + this.h > e.y) {
                let collisionType = null;
                if (!(this.overlap && e.overlap)) {
                    if (this.x + this.w <= e.x) { //right collision
                        collisionType = 'R';
                    } else if (this.x >= e.x + e.w) { //left collision
                        collisionType = 'L';
                    } else if (this.y + this.h <= e.y) { //down collision
                        collisionType = 'D';
                        downCollision=true;
                    } else if (this.y >= e.y + e.h) { //up collision
                        collisionType = 'U';
                    }
                }
                this.collisionHandler(e, collisionType, true);
                if (this.canCollision&&e.canCollision&&!(this.overlap && e.overlap)&&this.canMove) {
                    if (collisionType == 'R') { //right collision
                        this.vx = 0;
                        this.x = e.x - this.w;
                    } else if (collisionType == 'L') { //left collision
                        this.vx = 0;
                        this.x = e.x + e.w;
                    } else if (collisionType == 'D') { //down collision
                        this.vy = 0;
                        this.y = e.y - this.h;
                    } else if (collisionType == 'U') { //up collision
                        this.vy = 0;
                        this.y = e.y + e.h;
                    }
                }
            }
        }
        if (this.canMove) {
            if (downCollision) {
                if (this.vx > 0) this.vx -= this.friction;
                else this.vx += this.friction;
                if (Math.abs(this.vx) < 2) this.vx = 0;
            }
        }
    }
    move(){
        this.x += this.vx;
        this.y -= this.vy;
        this.vy += this.ga;
    }
    giveForce(ax, ay) {
        if(this.canMove){
            this.vx += ax*this.inv_mass;
            this.vy += ay*this.inv_mass;
        }
    }
    giveDamage(d){
        if(this.defense<d){
            this.life-=Math.floor(d);
            return true;
        }
        return false;
    }
    enlarge(per){this.w*=per; this.h*=per;}
    getVectorLength(){
        return Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    }
    getX(){return this.x+this.w/2}
    getY(){return this.y+this.h/2}
    //event handler
    collisionHandler(e, collisionType, isActor) { }
    removeHandler() { }
}

class Block extends Entity{
    color;
    //brokenSound=new Audio();
    constructor(x,y,w,h,color = "#080808",channelLevel=Game.PHYSICS_CHANNEL){
        super(x,y,channelLevel);
        this.w=w;this.h=h;this.color = color;this.overlap=false;this.life=w*h*2;
    }
    collisionHandler(e){
        this.life--;
        var damage=this.w*this.h*this.getVectorLength()/20;
        e.giveDamage(damage);
        e.giveForce(this.vx/5, this.vy/5);
    }
    giveForce(ax,ay){}
    getImager(){
        if(this.canDraw)return {t:1,x:Math.floor(this.x),y:Math.floor(this.y),w:this.w,h:this.h}
        else return {t:0};
    }
}

class MapBlock extends Entity{ 
    //안부숴지는
    textureType;
    constructor(x,y,w,h,textureType="wall",channelLevel=Game.PHYSICS_CHANNEL){
        super(x,y,channelLevel);
        this.w=w;this.h=h;this.ga=0;this.overlap=false;this.canRemoved=false;this.canAct=false;this.canMove=false;this.canInteract=false;
        this.textureType=textureType;
    }
    update(){}
    giveDamage(d, textColor=null){}
    giveForce(ax, ay) {}
    addAction(start, end, code) {}
    getImager(){return {t:2,x:Math.floor(this.x),y:Math.floor(this.y),w:this.w,h:this.h,textureType:this.textureType}}
}

const MATTERS=[
    {
        name:"fire",
        setStatus:function(e){
            e.power=500;
            //e.addAction(1,10000,function (){if(Game.time%15==0){new Particle(1,e.x,e.y);new Particle(0,e.x,e.y);}});
        },
        effect:function(e,v){v.giveDamage(e.power);v.giveForce(e.vx/e.inv_mass,(e.vy+1)/e.inv_mass);}
    },
    {
        name:"electricity",
        setStatus:function(e){e.power=150;},
        effect:function(e,v){v.giveDamage(e.power);v.vx=0;v.vy=0;}
    },
    {
        name:"ice",
        setStatus:function(e){e.power=200;},
        effect:function(e,v){
            v.giveDamage(Math.floor(this.getVectorLength())+e.power);
            v.addAction(1,150,function(){v.vx=0;v.vy=0;});
        }
    },
    {
        name:"arrow",
        setStatus:function(e){e.power=100;},
        effect:function(e,v){v.giveDamage(Math.floor(e.getVectorLength()*e.power));v.giveForce(e.vx/e.inv_mass,(e.vy+1)/e.inv_mass);}
    },
    {
        name:"energy",
        setStatus:function(e){e.power=1000;},
        effect:function(e,v){
            if(v instanceof Matter&&v.typenum==4){
                v.x=-10000;
                e.life+=v.life+1;v.life=0;
                e.w+=v.w;e.h+=v.h;
                e.x-=v.w/2;e.y-=v.h/2;
                e.giveForce(v.vx/v.inv_mass, v.vy/v.inv_mass);
                e.power+=v.power;
            }else{
                v.giveDamage(e.power);
                v.giveForce(e.vx,e.vy+1);
            }
        }
    },
    {
        name:"sword",
        setStatus:function(e){e.power=20;e.w*=e.getVectorLength()/5;e.h=e.w;},
        effect:function(e,v){
            v.giveDamage(e.w*e.power);
            v.giveForce(e.vx,e.vy+1);
        }
    }
];

class Matter extends Entity {
    typenum;power;
    effect=function(e){};
    constructor(typenum, x, y, vx = 0, vy = 0,channelLevel=Game.PHYSICS_CHANNEL) {
        super(x, y,channelLevel);
        this.vx = vx;
        this.vy = vy;
        this.w = 30;
        this.h = 30;
        this.ga = -0.02;
        this.inv_mass=4;
        let type=MATTERS[typenum];
        this.typenum=typenum;
        type.setStatus(this);
        this.effect=type.effect;
    }
    giveDamage(){
        this.life--;
    }
    collisionHandler(e) {
        if(!e.canCollision)return;
        this.life--;
        this.effect(this,e);
    }
    getImager(){
        if(this.canDraw)return {t:3,x:Math.floor(this.x),y:Math.floor(this.y),vx:this.vx,vy:this.vy,w:this.w,h:this.h,typenum:this.typenum}
        else return {t:0};
    }
}

class Player extends Entity{
    camera=null;
    cameraTarget=null;
    lv=1;mp=40;speed=4; 
    magicList=[];coolTime=[0,0,0,0];
    isRight=true;moveFlag=false;canJump=true;totalDamage=0;damageTick=0;
    constructor(x,y,lv=1,channelLevel=Game.PHYSICS_CHANNEL){
        super(x,y,channelLevel);
        //default
        this.camera={x:this.x,y:this.y};
        this.cameraTarget=this;
        this.w=30;
        this.h=60;
        this.ga=-0.2;
        this.friction=0.4;
        this.inv_mass=1;
        //lv
        this.lv=lv;
        this.life=lv*10000;
        this.mp=lv*20000;
    }
    update() {
        if (this.canAct) this.act();
        if (this.canInteract) this.interact();
        if(this.canMove)this.move();
        //damage
        if (this.totalDamage > 0) {
            new Text(this.x + this.w / 2, this.y - 50,this.totalDamage,30,"red","black",40);
            this.life -= this.totalDamage;
            this.totalDamage = 0;
        }
        if(this.mp<this.lv*20000)this.mp+=this.lv;
        if(this.damageTick>0)this.damageTick--;
        this.camera.x+=(this.cameraTarget.x-this.camera.x)/10;
        this.camera.y+=(this.cameraTarget.y-this.camera.y)/10;
    }
    getImager(){
        let _coolTime=[this.coolTime[0]-Game.time,this.coolTime[1]-Game.time,this.coolTime[2]-Game.time,this.coolTime[3]-Game.time];
        let _camera={x:Math.floor(this.camera.x),y:Math.floor(this.camera.y)};
        return {t:4,
        camera:_camera,
        x:this.x,y:this.y,w:this.w,h:this.h,
        moveFlag:this.moveFlag,isRight:this.isRight,life:this.life,mp:this.mp,coolTime:_coolTime,canDraw:this.canDraw};
    }
    move(){
        this.x += this.vx;
        this.y -= this.vy;
        this.vy += this.ga;
        if (this.moveFlag) {
            if (this.isRight && this.vx <= this.speed) this.vx = this.speed;
            else if (!this.isRight && this.vx >= -this.speed) this.vx = -this.speed;
        }
    }
    jump(){
        if(this.canJump){
            this.vy=this.speed+1;
            this.canJump=false;
        }
    }
    collisionHandler(e,ct){
        if(ct=='D'&&!this.canJump)this.canJump=true;
        else if(ct==null&&e instanceof MapBlock)this.giveDamage(10000);
    }
    giveDamage(d) {
        if(this.damageTick==0){
            this.totalDamage += Math.floor(d);
            if(d>0){
                this.vibrate((d<4000 ? d/200 : 20)+5);
                this.damageTick=4;
            }
        }
    }
    castMagic(num){
        //num 0:q 1:w 2:e 3:r
        if(this.coolTime[num]<Game.time&&this.mp>this.magicList[num][3]){
            //let magicEffect = new Particle(5, this.x+this.w/2-this.h/2, this.y);
            //magicEffect.w=this.h;
            //magicEffect.h=this.h;
            this.magicList[num][1](this);
            this.coolTime[num]=this.magicList[num][2]+Game.time;
            this.mp-=this.magicList[num][3];
        }
    }
    vibrate(power){
        this.camera.x+=power*(Math.random()-0.5>0 ? 1 : -1);
        this.camera.y+=power*(Math.random()-0.5>0 ? 1 : -1);
    }
}

class Text extends Entity{
    text;font;strokeColor;fillColor;camera;textBaseline="middle";textAlign="center";
    constructor(x,y,text="",size="1",fillColor=null,strokeColor=null,life=100,camera=true){
        super(x,y,Game.TEXT_CHANNEL);
        this.text=text;
        this.font="bold " + size + "px Arial";
        this.strokeColor=strokeColor;
        this.fillColor=fillColor;
        this.life=life;
        this.camera=camera;
        this.canInteract=false;
        this.ga=0;
        this.canRemoved=false;
    }
    update(){
        if(this.life>0)this.life--;
        else if(this.life==0) this.canRemoved=true;
        this.move();
    }
    getImager(){return {t:5,x:Math.floor(this.x),y:Math.floor(this.y),text:this.text}}
}

class Trigger extends Entity{
    code=function(e){};
    constructor(x,y,w,h,time,f){
        super(x,y,Game.PHYSICS_CHANNEL);
        this.w=w;this.h=h;this.life=time;this.ga=0;this.canCollision=false;this.canRemoved = true;this.code=f;
    }

    update() {
        if (this.canInteract) this.interact();
        if (this.canMove)this.move();
        this.life--;
    }
    getImager(){return {t:6,x:Math.floor(this.x),y:Math.floor(this.y),w:this.w,h:this.h}}
    collisionHandler(e){
        if(e instanceof MapBlock||!e.canCollision)return;
        this.code(e);
        this.life=0;
    }
    giveDamage(){}
    giveForce(){}
}