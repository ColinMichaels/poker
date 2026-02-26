<template>
    <div class="text-white">
        <h2 class="text-3xl mb-4 font-black">{{user_data.display_name}}</h2>
        <div class="text-white">
            <ul>
                <li v-for="playlist in playlists.items" class="flex flex-row my-2"  @click.once="getPlaylist(playlist.id)">
                    <img :src="(playlist.images[2])? playlist.images[2].url: 'http://via.placeholder.com/64x64.png?text='+playlist.name" :alt="playlist.name" v-if="playlist.images[2] !== null" class="bg-gray-300 w-16 h-16"/>
                    <span class="pl-4">
                        {{playlist.name}}
                    </span>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
    import Layout  from "@/Shared/Layout";
    export default {
        name: "Playlists",
        metaInfo:{
            title: 'Playlists'
        },
        layout: Layout,
        props: ['playlists', 'user_data'],
        methods:{
            getPlaylist(id){
                this.$inertia.post('/spotify/playlist', {
                    replace: true,
                    preserveState: true,
                    playlist_id : id
                });
            }
        }
    }
</script>
