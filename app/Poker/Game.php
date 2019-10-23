<?php

namespace Poker;

use InvalidArgumentException;
use Illuminate\Database\Eloquent\Model;

class Game extends Model
{

	const NUM_CARDS_PER_PLAYER = 5;
	const MAX_PLAYERS = 8;

	const BET_MIN = 1;
	public $players, $deck, $pot, $cur_player, $round, $last_bet;


	public function __construct() {

		$this->deck       = new Deck;
		$this->deck->shuffle();
		$this->pot        = 0;
		$this->cur_player = 0;
		$this->round      = 1;

	}

	public function round(){


	}

	public function bet($amount)
	{
		if($this->last_bet > $amount){
			throw new InvalidArgumentException('Bet must match or be greater than previous bet');
		}elseif($amount <= self::BET_MIN){
			throw new InvalidArgumentException('Bet must be greater than zero');
		}
		$this->pot += $amount;
		$this->last_bet = $amount;

		return $this->pot;
	}

	public function create($num_players)
    {
	     if($num_players >= self::MAX_PLAYERS) {
		     throw new InvalidArgumentException();
	     }
    	for($i =0; $i< $num_players; $i++){
    		$player = new Player($this->deck);
    		$this->players[] = $player;
	    }

         return $this;
    }

    public function is_royal_flush(){

    }

    public function is_flush(){

    }

    public function is_straight(){

    }

    public function is_four_of_a_kind(){


    }

    public function is_three_of_a_kind(){


    }

    public function is_a_pair(){


    }

    public function is_high_card(){


    }
}
