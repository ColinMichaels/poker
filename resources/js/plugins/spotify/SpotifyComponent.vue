<template>
    <div>

    </div>
</template>

<script>
    import Player from "@/plugins/spotify/Player";

    export default {
        name: "SpotifyComponent",
        data() {
            return {
                error: false,
                spotify_access_token: null
            }
        },
        components: {
            Player
        },
        props: ['login_url', 'is_logged_in'],
        methods: {
            login () {
                this.$inertia.replace('/spotify/auth/edit').then((response)=>{
                    console.log(response);
                });
            }
        },
        mounted(){
            if(localStorage.spotify_access_token){
                this.access_token = localStorage.spotify_access_token;
            }
        },
        watch:{
            access_token(newToken){
                localStorage.spotify_access_token = newToken;
            }
        }
    }
</script>

