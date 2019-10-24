<template>
    <div class="poker-chip min-w-1/8 max-w-1/8" @click="flip" :style="offset">
        <img class="w-full" :src="image" :alt="amount"/>
    </div>
</template>

<script>
    import {Howl} from 'howler';
    let chip = new Howl({
        src : [ '/Poker/sounds/chip.mp3' ]
    });
    let chip2 = new Howl({
        src: ['/Poker/sounds/chip2.mp3']
    });
    let chip3 = new Howl({
        src: ['/Poker/sounds/chip3.mp3']
    });
    export default {
        name: "PokerChip",
        props: ['image', 'amount','iteration'],
        data(){
            return {
               offset: "transform:translateX(-"+(this.iteration * 40)+"px)",
                sounds: [chip, chip2, chip3]
            }
        },
        methods:{
            flip(){
                let total_sounds = this.sounds.length;
                let cur_sound = Math.floor(Math.random() * Math.floor(total_sounds));
                this.sounds[cur_sound].play();
            }
        }
    }
</script>
