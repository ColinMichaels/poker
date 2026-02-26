<?php

namespace Poker;

use InvalidArgumentException;
use Illuminate\Database\Eloquent\Model;

/***
 * Class Game
 * @package Poker
 *
 * -accepts $options
 *  -- bet_max : int  | maximum bet
 *  -- bet_min : int  | minimum bet
 *  -- max_players : int  | total number of players allowed default: 52 / num_cards_per
 *  -- num_cards_per : int | How many cards are dealt per hand
 */

class Game extends Model {

    const BET_MAX = 1000;
    const BET_MIN = 1;
    const NUM_CARDS_PER = 5;
    const MAX_PLAYERS = 8;

    const STARTING_PLAYER = 0;
    const STARTING_POT = 0;

    const DEFAULT_GAME_VIEW = "games.poker.index";


    public $players, $deck, $pot, $cur_player, $round, $last_bet, $card_count;
    protected $BET_MAX,$BET_MIN, $MAX_PLAYERS, $NUM_CARDS_PER;

    public function __construct($options = null) {

        $this->deck = new Deck;
        $this->deck = $this->deck->shuffle();
        $this->pot        = Game::STARTING_POT;
        $this->cur_player = Game::STARTING_PLAYER;
        $this->round      = 1;
        $this->card_count = $this->deck->total_cards;
        $this->setOptions( $options );

        parent::__construct();

    }

    public function deal() {

        foreach ( $this->players as $player ) {
            for ( $i = 0; $i < $this->NUM_CARDS_PER; $i ++ ) {
                $player->draw($this->getTopCard());
                $this->remove_card_from_deck();
            }
        }

        return $this;
    }

    public function advance(){
         $this->round += 1;
         $this->cur_player = 0;
         foreach($this->players as $player){
               $player->draw($this->getTopCard());
               $this->remove_card_from_deck();
         }
    }

    public function bet( $amount ) {

        if ( $this->last_bet > $amount ) {
            throw new InvalidArgumentException( 'Bet must match or be greater than previous bet' );
        } elseif ( $amount <= $this->BET_MIN ) {
            throw new InvalidArgumentException( 'Bet must be greater than zero' );
        }
        $this->pot      += $amount;
        $this->last_bet = $amount;

        return $this->pot;
    }

    public function start( $num_players = Game::NUM_CARDS_PER ) {

        if ( $num_players > $this->MAX_PLAYERS ) {
            throw new InvalidArgumentException();
        }
        for ( $i = 0; $i < $num_players; $i ++ ) {
            $player          = new Player();
            $this->players[] = $player;
        }

        return $this;
    }

    /**
     * @param $options
     * @return void
     */
    protected function setOptions( $options ): void {
        $this->BET_MAX       = ( isset( $options['bet_max'] ) ) ? $options['bet_max'] : self::BET_MAX;
        $this->BET_MIN       = ( isset( $options['bet_min'] ) ) ? $options['bet_min'] : self::BET_MIN;
        $this->MAX_PLAYERS   = ( isset( $options['max_players'] ) ) ? $options['max_players'] : self::MAX_PLAYERS;
        $this->NUM_CARDS_PER = ( isset( $options['num_cards_per'] ) ) ? $options['num_cards_per'] : self::NUM_CARDS_PER;
    }

    /**
     * @return array
     */
    public function getOptions(): array {

        return [
            'bet_max'       => $this->BET_MAX,
            'bet_min'       => $this->BET_MIN,
            'max_players'   => $this->MAX_PLAYERS,
            'num_cards_per' => $this->NUM_CARDS_PER
        ];

    }

    protected function remove_card_from_deck(): void {
        $this->deck->removeCard( $this->card_count );
    }

    /**
     * @return mixed
     */
    protected function getTopCard() {
        $card = $this->deck->cards[$this->card_count -= 1];

        return $card;
    }
}
