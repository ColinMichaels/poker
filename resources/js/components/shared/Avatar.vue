<template>
    <div class="rounded-full mx-2" :class="bgcolor ? bgcolor : 'bg-white'" @click="$audio.play(sound ? sndSrc :  '/Poker/sounds/cha-ching.mp3')">
        <img :alt="name" :src="imgSrc" class="p-4" width="150px" height="150px" />
    </div>
</template>

<script>
    export default {
        name: "Avatar",
        props: ['name','bgcolor', 'sound'],
        data() {
            return {
                soundPath: "/Poker/sounds/",
                imagePath: "/Poker/avatars/",
                images: [
                    "andy-warhol",
                    "barack-obama",
                    "batman",
                    "brazilian-native-man",
                    "brazilian-native-woman",
                    "charlie-chaplin",
                    "construction-worker-black-woman",
                    "dalai-lama",
                    "dave-grohl",
                    "footballer-cristiano-ronaldo",
                    "footballer-luis-suarez",
                    "footballer-neymar-jr",
                    "girl-in-ballcap",
                    "mahatma-gandhi",
                    "malcolm-x",
                    "matrix-trinity",
                    "mick-jagger",
                    "muslim-man",
                    "muslim-woman",
                    "nikola-tesla",
                    "robot-01",
                    "robot-02",
                    "robot-03",
                    "superhero-black-panther",
                    "traditiona-japanese-man",
                    "traditional-african-man",
                    "traditional-african-woman",
                    "traditional-indian-man",
                    "traditional-indian-woman",
                    "traditional-japanese-woman"
                ]
            }
        },
        computed:{
            imgSrc: function(){
                return this.imagePath + this.name + ".svg";
            },
            sndSrc: function(){
                return this.soundPath + this.sound + ".mp3";
            }
        }
    }
</script>

<style scoped>

</style>
