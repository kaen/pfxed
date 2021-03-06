var PfxEd = (function () {
  var
    // rendering & simulation state
      STOPPED = -1
    , PAUSED = 0
    , PLAYING = 1
    , state
    , uiFocus = false
    , updateTimeout
    // time since last frame in seconds
    , frameTime

    // Particle class
    , Particle
    , particles = []

    // canvas & context data
    , canvas
    , ctx
    , width
    , height
    , mouseX
    , mouseY

    // user simulation functions
    , drawFunction
    , initFunction
    , updateFunction

    // particle emission control
    , startingParticles = 0
    , maxParticles = 1000
    , emitFrequency = 100
    , lastEmit
    , lastRun

    // physics constants
    , dampening = 1

    // boundary handling
    , boundaryAction
    , boundaryActions = {
        bounce: function () {
          if (this.x < 0 || this.x > width)
            this.xvel *= -dampening;

          if (this.y < 0 || this.y > height)
            this.yvel *= -dampening;
        }
      , clip: function () {
          this.x = Math.max(0, Math.min(this.x, width));
          this.y = Math.max(0, Math.min(this.y, height));
        }
      , destroy: function () {
          if (this.x < 0 || this.x > width || this.y < 0 || this.y > height)
            this.drop();
        }
      , none: function () {
        }
      }

    // animation shims
    , requestAnim = 
      window.requestAnimationFrame       ||
      window.webkitRequestAnimationFrame ||
      function (cb) { return setTimeout(cb, 1000/60); }

    , clearAnim =
      window.cancelAnimationFrame       ||
      window.webkitCancelAnimationFrame ||
      function (id) { return clearTimeout(id); }
  ;

  Particle = function () {
    this.x = 0;
    this.y = 0;
    this.xvel = 0;
    this.yvel = 0;
    this.r = 255;
    this.g = 255;
    this.b = 255;
    this.a = 1;
    this.index = null;

    initFunction.call(this);
  };

  Particle.prototype.add = function () {
    particles.push(this);
    this.index = particles.length - 1;
  };

  Particle.prototype.drop = function () {
    for (var i in particles) {
      if (particles[i] == this)
        particles.splice(i, 1);
    }
  };

  Particle.prototype.draw = function () {
    ctx.save();
    ctx.fillStyle = "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
    drawFunction.call(this);
    ctx.restore();
  };

  Particle.prototype.updatePhysics = function () {
    this.x += this.xvel * frameTime;
    this.y += this.yvel * frameTime;

    boundaryAction.call(this);

    updateFunction.call(this);
  };

  function setBackground () {
    $("canvas").css("background", $("input[name=background]:checked").val());
  }

  function setBoundaryAction () {
    boundaryAction = boundaryActions[$("input[name=boundaryAction]:checked").val()];
  }

  function clear () {
    ctx.clearRect(0, 0, width, height);
  }

  function run () {
    var now = new Date().getTime();
    frameTime = (now - lastRun) / 1000;
    lastRun = lastRun || now;
    lastEmit = lastEmit || now;
    if (state <= PAUSED)
      return;

    clear();

    for (var p in particles) {
      particles[p].draw();
    }

    for (var p in particles) {
      particles[p].updatePhysics();
    }

    // emit one particle per emission interval since the last emission time
    var count = Math.floor((now - lastEmit) / (1000/emitFrequency));
    for (var i = 1; i <= count; i++) {
      if (particles.length <= maxParticles)
        new Particle().add();
    }
    lastEmit += count * (1000/emitFrequency);

    updateTimeout = requestAnim(run);
    lastRun = now;
  }

/**
 * Control Funtions
 **/

  function togglePlay () {
    lastRun = lastEmit = new Date().getTime();
    if (state == STOPPED) {
      start();
      run();
    } else if (state == PAUSED) {
      state = PLAYING;
      run();
    } else {
      state = PAUSED;
    }

    return false;
  }

  function start () {
    initFunction = eval("(function () { " + $("#init-function").val() + " })");
    drawFunction = eval("(function () { " + $("#draw-function").val() + " })");
    updateFunction = eval("(function () { " + $("#update-function").val() + " })");

    maxParticles = parseInt($("#maxParticles").val());
    emitFrequency = parseInt($("#emitFrequency").val());

    var p;
    for (var i = 0; i < startingParticles; i++) {
      p = new Particle();
      p.add();
    }
    state = PLAYING;
    lastRun = lastEmit = new Date().getTime();
  }

  function stop () {
    state = STOPPED;
    clear();
    clearAnim(updateTimeout);

    showWelcomeText();

    particles = [];
    return false;
  }

  function restart () {
    stop();
    start();
    run();
    return false;
  }

  function keyHandler (ev) {
    if (uiFocus)
      return;

    switch (ev.which) {
      case 112:
        togglePlay();
      break;
      case 114:
        restart();
      break;
      case 115:
        stop();
      break;

      default:
        return true;
    }

    return false;
  }

  function getPosition (el) {
    var position = { left: el.offsetLeft, top: el.offsetTop },
        parentPosition = { left: 0, top: 0 };

    if (!!el.offsetParent) {
      parentPosition = getPosition(el.offsetParent);
    }
    return { left: position.left + parentPosition.left,
             top: position.top + parentPosition.top };
  }

  function mouseMoveHandler (ev) {
    var pos = getPosition(canvas);
    mouseX = ev.pageX - pos.left;
    mouseY = ev.pageY - pos.top;
  }

  function showWelcomeText () {
    var welcomeText = "Press \"play\" to begin";
    ctx.font = "20px Arial"
    ctx.fillText(
      welcomeText,
      (width - ctx.measureText(welcomeText).width)/2,
      height/2
    );
  }

  function init (element) {
    // build UI
    element.append($("<div id='ui'>")
      .append($("<div id='play-control'>")
        .append($('<button id="play-pause" class="control">play</button>'))
        .append($('<button id="stop" class="control">stop</button>'))
        .append($('<button id="restart" class="control">restart</button>'))
      )
      .append($("<div id='options'>")
        .append($("<ul>")
          .append($("<li><a href='#pfx-limits'>Particle Limits</a></li>"))
          .append($("<li><a href='#pfx-bounds'>Boundary Action</a></li>"))
          .append($("<li><a href='#pfx-background'>Background</a></li>"))
          .append($("<li><a href='#pfx-functions'>Functions</a></li>"))
        )
        .append($("<div id='pfx-limits'>")
          .append($("<label for='maxParticles'>Max Particles</label>"))
          .append($("<input id='maxParticles' type='text'>"))
          .append($("<label for='emitFrequency'>Emit Frequency</label>"))
          .append($("<input id='emitFrequency' type='text'>"))
        )
        .append($("<div id='pfx-bounds'>")
          .append($("<input type='radio' name='boundaryAction' value='bounce' checked >Bounce</input></br>"))
          .append($("<input type='radio' name='boundaryAction' value='clip' >Clip</input></br>"))
          .append($("<input type='radio' name='boundaryAction' value='none' >None</input></br>"))
          .append($("<input type='radio' name='boundaryAction' value='destroy' >Destroy</input>"))
        )
        .append($("<div id='pfx-background'>")
          .append($("<input type='radio' name='background' value='white' >White</input></br>"))
          .append($("<input type='radio' name='background' value='black' checked >Black</input></br>"))
          .append($("<input type='radio' name='background' value='none' >None</input></br>"))
        )
        .append($("<div id='pfx-functions'>")
          .append($("<div id='functions'>"))
          .append($("<form id='function-texts'>")
            .append($('<fieldset>')
              .append($("<legend>Init</legend>"))
              .append($('<textarea spellcheck="false" id="init-function">'))
            )
            .append($('<fieldset>')
              .append($("<legend>Draw</legend>"))
              .append($('<textarea spellcheck="false" id="draw-function">'))
            )
            .append($('<fieldset>')
              .append($("<legend>Update</legend>"))
              .append($('<textarea spellcheck="false" id="update-function">'))
            )
          )
        )
      )
    );

    $("#emitFrequency").val(emitFrequency);
    $("#emitFrequency").change(function () {
      emitFrequency = $("#emitFrequency").val();
    });

    $("#maxParticles").val(maxParticles);
    $("#maxParticles").change(function () {
      maxParticles = $("#maxParticles").val();
    });

    width = parseInt($("#ui").css("width"));
    width = Math.min(width, 600);
    height = width / 1.25;
    $('#ui').before("<canvas width=\"" + width + "\" height=\"" + height + "\"></canvas>");
    canvas = $("canvas").get()[0];

    ctx = canvas.getContext('2d');
    ctx.fillStyle="rgba(255,255,255,1)";

    setBoundaryAction();
    $("input[name=boundaryAction]").change(setBoundaryAction);

    setBackground();
    $("input[name=background]").change(setBackground);

    showWelcomeText();

    $("#play-pause").click(togglePlay);
    $("#stop").click(stop);
    $("#restart").click(restart);
    $(document).keypress(keyHandler);
    $(document).mousemove(mouseMoveHandler);
    $("#ui").focusin(function () { uiFocus = true; });
    $("#ui").focusout(function () { uiFocus = false; });
    $("#options").submit(function () { restart(); return false; });

    // add buttons for textarea toggling
    var $textAreas = $("#function-texts textarea").get();
    var $newElement;
    for (var e in $textAreas) {
      $newElement = $('<button id="' + $textAreas[e].id + '-button" class="function-button">' + $textAreas[e].id  + '</button>')
      $newElement.get()[0].target = $($textAreas[e]).parent();
      $("#functions").append($newElement);
      $newElement.click(function () { $(this.target).toggle(); return false; });
    }

    // jQueryUI stuff
    $('#options').tabs({ selected: 3 });
    $('#options').show();
  }

  function destroy () {
    $(document).unbind("keypress");
    $(document).unbind("mousemove");
  }

  return {
      init: init
    , destroy: destroy
    , start: start
    , stop: stop
    , run: run
  }
})();
