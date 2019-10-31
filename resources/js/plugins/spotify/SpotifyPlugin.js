import SpotifyComponent from './SpotifyComponent';

let SpotifyPlugin = {
    install: function (Vue, options = {}) {
        Vue.component('spotify', SpotifyComponent);

        SpotifyPlugin.events = new Vue();

        Vue.prototype.$game = {
            start(name,params = {}){
                console.log('i should be starting, a game of '+name);
                location.hash = name;
                SpotifyPlugin.events.$emit('spotify.loaded', name);
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
            state:
                {
                    is_started: false,
                    is_playing : false,
                    is_completed: false
                },
                credentials:{
                        client_id : process.env.MIX_SPOTIFY_CLIENT_ID,
                        client_secret : process.env.MIX_SPOTIFY_CLIENT_SECRET,
                        callback_url : process.env.MIX_SPOTIFY_CALLBACK_URL
                }

        };

    }
};

export default SpotifyPlugin;



