<?php
namespace Poker;

use App\User;
use Illuminate\Database\Eloquent\Model;

class Player extends User
{

	public $name, $hand, $wallet;

	const STARTING_WALLET = 0;
	protected $guarded = ['*'];

	public function __construct($wallet = null) {
		$this->hand = new Hand();
		$this->wallet = $wallet ?? rand(5,10000); //Player::STARTING_WALLET;
        $this->name = 'Player-'.uniqid();


	}

	public function user(){
	    return $this->belongsTo(User::class, 'user_id');
    }

	public function chips(){

         return (new Chip($this->wallet))->split();

    }

	public function getWallet(){
		return $this->wallet;
	}

	public function withdraw($amount){

		 return  $this->wallet -= $amount;

	}

    public function draw($card){
       $this->hand->addCardToHand($card);
    }

}
