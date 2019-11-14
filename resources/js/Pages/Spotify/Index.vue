<template>
	    <div>
            <spotify-auth
                :login_url="login_url"
                v-if="!is_logged_in"
            ></spotify-auth>
            <profile v-if="is_logged_in" :user_data="user_data"></profile>
        </div>
</template>

<script>
    import Layout from "@/Shared/Layout"
    import SpotifyAuth from "./Auth";
    import Profile from "./Profile";
    export default {
        name: "Index",
        props: ['login_url','is_logged_in', 'user_data'],
        metaInfo:{
            title: "Spotify Login"
        },
        layout: Layout,
        components:{
            Profile,
            SpotifyAuth
        }
    }
</script>

