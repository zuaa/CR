import 'babel-polyfill'

import React from 'react'
import { browserHistory, hashHistory, Router, Route, IndexRoute } from 'react-router'
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import injectTapEventPlugin from 'react-tap-event-plugin'

import App from './components/App.jsx'
import Login from './pages/login/Login.jsx'
import SignUp from './pages/signup/SignUp.jsx'
import Index from './pages/index/'
// import Edit from './pages/edit/index.jsx'

import store from './store'

import {
    socket,
    getInitUserInfo, 
    getInitOnlineUser, 
    addOnlineUser, 
    deleteLogoutUser, 
    addMessage, 
    getRoomHistory, 
    changeUserInfo, 
    addPrivateMessage, 
    addCount, 
    setAudioSrc, 
    setAudioState, 
    setNotificationState, 
    setShieldUser, 
    setSpecialUser, 
    initStorageExpression,
    getActiveList,
    getRoomList,
    setListShow,
    searchRoom,
    changeRoom,
    addActiveItem,
    setBgImage,
    getRoomActiveInfo,
    searchUser
} from './actions'

import notification from './util/notification.js'
import favico from './util/favicoNotification.js'
import browser from './util/browser.js'

import Immutable from 'immutable'

favico.resetWhenDocVisibility();
notification.requestPermission();

const handleInit = (info) => {
    getActiveList(info.token)(store.dispatch).then((res)=>{
        return getRoomList(info.token)(store.dispatch);
    }).then(() => {
        return getInitUserInfo(info)(store.dispatch);
    }).then((resault)=>{
        let storage = localStorage.getItem(resault.nickname);
        storage = storage ? JSON.parse(storage) : {};
        let setting = storage.setting;
        if(setting){
            store.dispatch(setNotificationState(setting.h5Notification));
            store.dispatch(setAudioState(!!(setting.audioNotification)));
            store.dispatch(setShieldUser({
                user: setting.shield,
                isAdd: true
            }));
            store.dispatch(setBgImage(setting.bgImage));
            store.dispatch(setSpecialUser({
                user: setting.special,
                isAdd: true
            }));
        };
        if(storage.expressions){
            store.dispatch(initStorageExpression(storage.expressions));
        }
        return changeRoom({curRoom: resault.curRoom,isPrivate: false})(store.dispatch,store.getState);
    }).catch((err) => {
        console.log(err);
        browserHistory.push('/login');
    })
}
const handleEnter = (nextState,replace) => {
    const token = localStorage.getItem('token');
    const device = browser.versions.mobile ? 'mobile' : 'PC';
    if(token){
        return handleInit({token,device});
    } else{
        replace({pathname: '/login'});
    }
}
const handleLeave = () => {
    const state = store.getState().toJS();
    const token = state.userState.token;
    if(token){
        socket.emit('reconnect success',token);
    }
}
socket.on('privateMessage', (message) => {
    const state = store.getState().toJS();
    if(state.setting.shield.indexOf(message.nickname) === -1){
        const audio = document.getElementById('audio1'),
              audioSpecial = document.getElementById('audio3'),
              avatar = message.avatar;
        message.room = message.nickname;
        if(state.pageState.listState !== 'activeList'){
            store.dispatch(setListShow('activeList'));
        }
        store.dispatch(addPrivateMessage(message));
        state.userState.curRoom === message.room ? null : store.dispatch(addCount(message.room));
        if(!state['activeList'][message.room]){
            store.dispatch(addActiveItem({
                roomName: message.room,
                avatar: message.avatar,
                isPrivate: true
            }))
        }
        if(document.hidden){
            favico.addBage();        
            if(state.setting.audioNotification){
                state.setting.special.indexOf(message.nickname) === -1 ? audio.play() : audioSpecial.play();
            }    
            state.setting.h5Notification ? notification.showNotification(message.nickname,{
                body: message.content,
                icon: message.avatar,
            }) : null;
        } else if(state.setting.audioNotification && state.userState.curRoom !== message.room){
            state.setting.special.indexOf(message.nickname) === -1 ? audio.play() : audioSpecial.play();
        }
    }
});
socket.on('newMessage', (message) => {
    const state = store.getState().toJS();
    if(state.setting.shield.indexOf(message.nickname) === -1){
        const audio = document.getElementById('audio1'),
              audioSpecial = document.getElementById('audio3'),
              avatar = message.avatar,
              reg = new RegExp('@'+state.userState.nickname,'g');
        store.dispatch(addMessage(message));
        state.userState.curRoom === message.room ? null : store.dispatch(addCount(message.room));
        if(!state['activeList'][message.room]){
            store.dispatch(addActiveItem({
                roomName: message.room,
                avatar: state['roomList'][message.room]['avatar'],
                isPrivate: false
            }))
        }
        if(document.hidden){
            favico.addBage();
            if(state.setting.audioNotification){
                state.setting.special.indexOf(message.nickname) !== -1 || reg.test(message.content) ? audioSpecial.play() : audio.play() ;
            }
            state.setting.h5Notification && !(message.nickname === state.userState.nickname) ? notification.showNotification(message.nickname,{
                body: message.content,
                icon: message.avatar,
            }) : null;
        } else if(!(message.nickname === state.userState.nickname) && state.setting.audioNotification && state.userState.curRoom !== message.room){
            state.setting.special.indexOf(message.nickname) !== -1 || reg.test(message.content) ? audioSpecial.play() : audio.play();
        }
    }
});

socket.on('disconnect',()=>{
    console.log('disconnect');
    const state = store.getState().toJS();
    store.dispatch(addMessage({
        content: '掉线重连中...',
        room: state.userState.curRoom,
        type: 'systemMessage'
    }));
})
let reconnect = 0;
socket.on('connect', () => {
    if(reconnect > 0){
        const state = store.getState().toJS();
        const token = state.userState.token;
        if(!token){
            return browserHistory.push('/login')
        }
        handleInit({token});
    }
})

socket.on('reconnect_failed',()=>{
    console.log('重连失败');
})

socket.on('reconnect',()=>{
    console.log('断线重连成功');
    const state = store.getState().toJS();
    const token = state.userState.token;  
    if(!token){
        return browserHistory.push('/login')
    }
    socket.emit('reconnect success',token);
})
socket.on('reconnecting',()=>{
    reconnect++;
    console.log('重新连接#('+reconnect+')');
})

injectTapEventPlugin();
render(
    <Provider store={store}>
        <div>
            <Router history = {browserHistory}>
                <Route path = '/' component = {App} >
                    <IndexRoute component= {Index} onEnter = {(nextState,replace)=>handleEnter(nextState,replace)} onLeave = {()=>handleLeave()}/>
                    <Route path= 'login' component= {Login} />
                    <Route path= 'signUp' component= {SignUp} />
                </Route>
            </Router>
        </div>
    </Provider>
    ,
    document.getElementById('App')
)



// 加入房间逻辑，以及信息发送逻辑，历史记录查询未按照加入房间名