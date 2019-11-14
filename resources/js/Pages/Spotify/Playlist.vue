<template>
	     <div class="text-white">
             <div class="links">
                 <inertia-link href="/spotify" replace>Spotify</inertia-link>
             </div>
             <h2 class="text-3xl font-black mb-2">{{playlist.name}}</h2>
             <p class="text-gray-300 text-sm mx-2">{{playlist.description}}</p>
             <img :src="playlist.images[1].url" :alt="playlist.name" v-if="playlist.images[0] !== null"/>
             <h4 class="text-2xl my-4">Songs:</h4>
             <table>
                 <thead>
                    <tr>
                       <th>Title</th>
                       <th>Artist</th>
                        <th>Album</th>
                    </tr>
                 </thead>
                 <tbody>
                 <tr v-for="track in tracks"  v-if="track !== null" class="table-row">
                     <td class="py-2">
                         <button @click.once="controls(track.track.uri, 'play')"
                                 v-if="track.track !== null">
                             {{track.track.name}}
                         </button>
                     </td>
                     <td>
                         {{track.track.artists[0].name}}
                     </td>
                     <td>
                         {{track.track.album.name}}
                     </td>
                 </tr>
                 </tbody>
             </table>
         </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    import AudioPlugin from "@/plugins/audio/AudioPlugin";
    export default {
        name: "Playlist",
        layout: Layout,
        metaInfo:{
            title: 'Spotify Playlist'
        },
        methods:{
            controls(uri, event){
              this.$inertia.post('/spotify/controls/'+event,
                  {
                      uri: uri,
                      access_token: localStorage.spotify_access_token
                  },
                  {
                      replace: true
                  }

              ).then((response)=>{
                  console.log(response);
              });
            }
        },
        props: ['playlist', 'tracks']
    }
</script>
