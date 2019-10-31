import GameComponent from './GameComponent';
import CardsList from './cardsList';

let GamePlugin = {
    install: function (Vue, options = {}) {
        Vue.component('game', GameComponent);
        console.info("REGISTERING GAME PLUGIN KEY:"+ options.key);
        GamePlugin.events = new Vue();

        Vue.prototype.$game = {
            start(name,params = {}){
                console.log('i should be starting, a game of '+name);
                location.hash = name;
                GamePlugin.events.$emit('game.start', name);
            },
        }
    },
    broadcast(channel, message){
          this.events.$emit(channel, message);
    },
    listen(channel, message){
        return this.events.$on(channel, message);
    },
    store(){
        return {
                state:{
                        is_started: false,
                        is_completed: false,
                        is_flipped: false,
                    },
                cards: CardsList

        };

    }
};

export default GamePlugin;
