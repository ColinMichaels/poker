<template>
    <div class="card-container" :class="{flipped: !flipped}" @click="clicked">
        <div class="card">
            <div class="card-front">
                <img :src="card_image_front" :alt="description"/>
            </div>
            <div class="card-back">
                <img :src="card_back" :alt="description"/>
            </div>
        </div>
    </div>
</template>

<script>
    import  {SUITS} from './suits';
    import  {NAMES} from './names';
    import Game from '@/plugins/game/GamePlugin';
    import AudioPlugin from "@/plugins/audio/AudioPlugin";
    let sound = AudioPlugin.load('/Poker/sounds/card.mp3');

    const imagePath = '/Poker/cards/';

    export default {
        name: "PokerCard",
        props: {
            name,
            is_flipped: {
                type: Boolean,
                default: false
            },
            is_frozen:{
               type: Boolean,
               default: false
            },
        },
        data() {
            return {
                card_back: '/Poker/cards/Card_back_06.svg',
                card_front: '/Poker/cards/AS.svg',
                flipped : this.is_flipped
            }
        },
        methods: {
            clicked() {
                if(!this.is_frozen) {
                    sound.play();
                    this.flipped = !this.flipped;
                    Game.broadcast('card.clicked', this.name);
                }
            }
        },
        computed: {
            card_image_front() {
                return this.card_front = imagePath + this.name + '.svg';
            },
            description() {
                let name = this.name.match(/[A-Z | 0-9](?=[A-Z| 0-9])+/g);
                let suit = this.name.match(/[A-Z](?![A-Z])+/g);
               return  NAMES[name] + " of " + SUITS[suit];
            }
        }
    }
</script>
