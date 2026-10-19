# bitGen Bridge for Unreal Engine 5.8 - run by the editor when it opens (the Python Editor Script Plugin runs every
# init_unreal.py in a plugin's Content/Python). Starts the bridge (bitgen_bridge.py) for bitGen Studio.
import unreal

try:
    import bitgen_bridge
    bitgen_bridge.start()
except Exception as e:  # never stop the editor from opening
    unreal.log_warning("[bitGen Bridge] did not start: %s" % e)
