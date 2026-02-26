import {Howl} from 'howler';

let AudioPlugin = {
    install: function (Vue, options = {}) {

        AudioPlugin.events = new Vue();

        Vue.prototype.$audio = {
            play(src,params = {}){
                this.load(src).play();
            },
            load(src){
                return new Howl({ src: [src]})
            }
        }
    },
    play: function(src){
        this.load(src).play();
    },
    load: function(src){

        return new Howl({ src: [src]})

    }
};

export default AudioPlugin;
