import GameComponent from './GameComponent';

let GamePlugin = {
    install: function (Vue, options = {}) {
        Vue.component('game', GameComponent);

        GamePlugin.events = new Vue();

        Vue.prototype.$game = {
            start(name,params = {}){
                console.log('i should be starting, a game of '+name);
                location.hash = name;
                GamePlugin.events.$emit('start', name);
            },
        }
    }
};

export default GamePlugin;
